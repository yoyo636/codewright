import Foundation

/// File browser backed by codewright's `/api/fs/*` endpoints.
struct FSNode: Codable, Identifiable, Hashable {
    let name: String
    let type: String   // "file" | "dir"
    let size: Int?
    var isDirectory: Bool { type == "dir" }
    var id: String { name }
}

struct FileSystem {
    let client: APIClient

    func list(path: String) async throws -> [FSNode] {
        let url = client.url("/api/fs/list?path=\(path.addingPercentEncoding(withAllowedCharacters: .urlPathAllowed) ?? path)")
        let nodes: [FSNode] = try await client.get(url)
        return nodes.sorted { a, b in
            if a.isDirectory != b.isDirectory { return a.isDirectory }
            return a.name.localizedCaseInsensitiveCompare(b.name) == .orderedAscending
        }
    }

    func read(path: String) async throws -> String {
        let safe = path.addingPercentEncoding(withAllowedCharacters: .urlPathAllowed) ?? path
        let url = client.url("/api/fs/read\(safe)")
        var req = URLRequest(url: url)
        req.httpMethod = "GET"
        let (data, _) = try await URLSession.shared.data(for: req)
        return String(data: data, encoding: .utf8) ?? ""
    }
}
