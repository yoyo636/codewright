import Foundation

// MARK: - Core API models (aligned with codewright OpenAPI spec)

struct Session: Codable, Identifiable, Hashable {
    let id: String
    let slug: String
    let projectID: String
    let workspaceID: String?
    let directory: String
    let path: String?
    let parentID: String?
    var title: String
    let agent: String?
    let model: ModelRef?
    let version: String
    let cost: Double?
    let tokens: TokenCount?
    let permission: PermissionRuleset?

    struct ModelRef: Codable, Hashable {
        let providerID: String?
        let modelID: String?
    }
    struct TokenCount: Codable, Hashable {
        let input: Int?
        let output: Int?
        let total: Int?
    }
    struct PermissionRuleset: Codable, Hashable {
        let mode: String?
        let additional: [String]?
    }
}

struct Message: Codable, Identifiable, Hashable {
    let id: String
    let sessionID: String?
    let role: String
    let time: Double?
    let cost: Double?
    let tokens: Session.TokenCount?
    var parts: [MessagePart]?

    var isUser: Bool { role == "user" }
    var isAssistant: Bool { role == "assistant" }

    /// Flattened text content for quick display.
    var text: String {
        (parts ?? []).compactMap { $0.text }.joined(separator: "\n")
    }
}

struct MessagePart: Codable, Identifiable, Hashable {
    let id: String?
    let type: String
    let text: String?
    let tool: ToolCall?
    let state: String?
    let name: String?
    private let uuid = UUID()

    var stableID: String { id ?? uuid.uuidString }

    enum CodingKeys: String, CodingKey {
        case id, type, text, tool, state, name
    }
}

struct ToolCall: Codable, Hashable {
    let name: String?
    let callID: String?
    let state: String?
    let input: String?
    let output: String?

    enum CodingKeys: String, CodingKey {
        case name, callID = "callID", state, input, output
    }
}

struct PermissionRequest: Codable, Identifiable, Hashable {
    let id: String
    let sessionID: String
    let permission: String
    let patterns: [String]
    let metadata: [String: String]?
    let always: [String]?
    let tool: ToolCall?

    /// Human readable description of what is being requested.
    var summary: String {
        if let toolName = tool?.name {
            return "\(toolName)  →  \(permission)"
        }
        return permission
    }
}

struct Question: Codable, Identifiable, Hashable {
    let id: String
    let sessionID: String?
    let question: String?
    let options: [String]?
    let multiple: Bool?

    enum CodingKeys: String, CodingKey {
        case id, sessionID = "sessionID", question, options, multiple
    }
}

struct Model: Codable, Identifiable, Hashable {
    let id: String
    let providerID: String
    let name: String
    let family: String?
    let status: String?
    let capabilities: [String: AnyCodable]?
    let cost: [String: AnyCodable]?

    var isAvailable: Bool { status == nil || status == "available" || status == "ok" }
}

struct Provider: Codable, Identifiable, Hashable {
    let id: String
    let name: String
    let source: String?
    let env: [String]?
    let key: String?
}

struct Agent: Codable, Identifiable, Hashable {
    var id: String { name }
    let name: String
    let description: String?
    let mode: String
    let native: Bool?
    let hidden: Bool?
    let color: String?
}

// MARK: - Lenient JSON value (for arbitrary metadata)

struct AnyCodable: Codable, Hashable {
    let value: Any

    init(_ value: Any) { self.value = value }

    init(from decoder: Decoder) throws {
        let container = try decoder.singleValueContainer()
        if container.decodeNil() {
            self.value = NSNull()
        } else if let b = try? container.decode(Bool.self) {
            self.value = b
        } else if let i = try? container.decode(Int.self) {
            self.value = i
        } else if let d = try? container.decode(Double.self) {
            self.value = d
        } else if let s = try? container.decode(String.self) {
            self.value = s
        } else if let a = try? container.decode([AnyCodable].self) {
            self.value = a
        } else if let dict = try? container.decode([String: AnyCodable].self) {
            self.value = dict
        } else {
            self.value = NSNull()
        }
    }

    func encode(to encoder: Encoder) throws {
        var container = encoder.singleValueContainer()
        switch value {
        case let b as Bool: try container.encode(b)
        case let i as Int: try container.encode(i)
        case let d as Double: try container.encode(d)
        case let s as String: try container.encode(s)
        case let a as [AnyCodable]: try container.encode(a)
        case let dict as [String: AnyCodable]: try container.encode(dict)
        default: try container.encodeNil()
        }
    }

    static func == (lhs: AnyCodable, rhs: AnyCodable) -> Bool {
        String(describing: lhs.value) == String(describing: rhs.value)
    }

    func hash(into hasher: inout Hasher) {
        hasher.combine(String(describing: value))
    }
}


// MARK: - Local app configuration (persisted via UserDefaults)

struct AppConfig: Codable {
    var host: String = "127.0.0.1"
    var port: Int = 4096
    var launchLocalServer: Bool = true
    var defaultAgent: String = "codewright"
    var defaultModel: String = ""
    var defaultDirectory: String = ""
    var approvalMode: ApprovalMode = .suggest
    var apiKey: String = ""

    enum ApprovalMode: String, Codable, CaseIterable {
        case suggest = "suggest"
        case autoEdit = "auto-edit"
        case fullAuto = "full-auto"
        var label: String {
            switch self {
            case .suggest: return "Suggest (ask first)"
            case .autoEdit: return "Auto-edit (files only)"
            case .fullAuto: return "Full-auto (dangerous)"
            }
        }
    }

    var baseURL: URL { URL(string: "http://\(host):\(port)") ?? URL(string: "http://127.0.0.1:4096")! }
}

// MARK: - Streaming events

enum StreamEvent {
    case session(Session)
    case message(Message)
    case part(MessagePart)
    case permission(PermissionRequest)
    case question(Question)
    case summary(String)
    case error(String)
    case done
    case raw(String)
}
