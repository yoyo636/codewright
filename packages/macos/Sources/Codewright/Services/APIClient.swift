import Foundation

enum APIError: LocalizedError {
    case http(Int)
    case empty
    case transport(String)
    var errorDescription: String? {
        switch self {
        case .http(let c): return "HTTP \(c)"
        case .empty: return "Empty response"
        case .transport(let m): return m
        }
    }
}

struct AnyEncodable: Encodable {
    let e: Encodable
    func encode(to encoder: Encoder) throws { try e.encode(to: encoder) }
}

struct SessionInput: Encodable {
    let directory: String
    var agent: String?
    var model: String?
}
struct PromptPayload: Encodable {
    let text: String
    var files: [String] = []
    var agents: [String] = []
}
struct PermissionReply: Encodable {
    let decision: String
    var always: Bool = false
}
struct InterruptPayload: Encodable {
    let reason: String = "user"
}
struct EmptyBody: Encodable {}

/// Thin async HTTP + SSE client for the `codewright serve` REST API.
@MainActor
final class APIClient {
    let baseURL: URL
    init(baseURL: URL) { self.baseURL = baseURL }

    var fs: FileSystem { FileSystem(client: self) }

    nonisolated func url(_ path: String) -> URL {
        URL(string: path, relativeTo: baseURL) ?? baseURL
    }

    private func check(_ resp: URLResponse) throws {
        if let http = resp as? HTTPURLResponse, !(200...299).contains(http.statusCode) {
            throw APIError.http(http.statusCode)
        }
    }

    private func perform(_ url: URL, method: String = "GET", encodable: Encodable? = nil) async throws -> Data {
        var req = URLRequest(url: url)
        req.httpMethod = method
        if let encodable {
            req.setValue("application/json", forHTTPHeaderField: "Content-Type")
            req.httpBody = try JSONEncoder().encode(AnyEncodable(e: encodable))
        }
        let (data, resp) = try await URLSession.shared.data(for: req)
        try check(resp)
        return data
    }

    func get<T: Decodable>(_ url: URL) async throws -> T {
        try JSONDecoder().decode(T.self, from: try await perform(url))
    }

    func post<T: Decodable>(_ url: URL, _ body: some Encodable) async throws -> T {
        try JSONDecoder().decode(T.self, from: try await perform(url, method: "POST", encodable: body))
    }

    func command(_ url: URL, method: String = "POST", _ body: some Encodable) async throws {
        _ = try await perform(url, method: method, encodable: body)
    }

    // MARK: - Health
    func health() async -> Bool {
        do { let _: [String: AnyCodable] = try await get(url("/api/health")); return true }
        catch { return false }
    }

    // MARK: - Sessions
    func listSessions() async throws -> [Session] { try await get(url("/api/session")) }
    func getSession(_ id: String) async throws -> Session { try await get(url("/api/session/\(id)")) }
    func createSession(directory: String, agent: String? = nil, model: String? = nil) async throws -> Session {
        try await post(url("/api/session"), SessionInput(directory: directory, agent: agent, model: model))
    }
    func listMessages(_ sessionID: String) async throws -> [Message] {
        try await get(url("/api/session/\(sessionID)/message"))
    }

    // MARK: - Prompt (SSE)
    func sendPrompt(sessionID: String, text: String, files: [String] = [],
                    onEvent: @escaping (StreamEvent) -> Void) async throws {
        var req = URLRequest(url: url("/api/session/\(sessionID)/prompt"))
        req.httpMethod = "POST"
        req.setValue("application/json", forHTTPHeaderField: "Content-Type")
        req.httpBody = try JSONEncoder().encode(PromptPayload(text: text, files: files))
        let (bytes, resp) = try await URLSession.shared.bytes(for: req)
        if let http = resp as? HTTPURLResponse, !(200...299).contains(http.statusCode) {
            throw APIError.http(http.statusCode)
        }
        let parser = SSEParser { ev, data in onEvent(StreamEvent.from(eventType: ev, data: data)) }
        for try await line in bytes.lines {
            parser.feed(line)
        }
        parser.finish()
    }

    // MARK: - Permissions / approval
    func replyPermission(sessionID: String, requestID: String, decision: String, always: Bool = false) async throws {
        try await command(url("/api/session/\(sessionID)/permission/\(requestID)/reply"),
                          PermissionReply(decision: decision, always: always))
    }

    // MARK: - Control
    func interrupt(_ sessionID: String) async throws {
        try await command(url("/api/session/\(sessionID)/interrupt"), InterruptPayload())
    }
    func revert(_ sessionID: String) async throws {
        try await command(url("/api/session/\(sessionID)/revert"), EmptyBody())
    }

    // MARK: - Config
    func listModels() async throws -> [Model] { try await get(url("/api/model")) }
    func listProviders() async throws -> [Provider] { try await get(url("/api/provider")) }
    func listAgents() async throws -> [Agent] { try await get(url("/api/agent")) }
}
