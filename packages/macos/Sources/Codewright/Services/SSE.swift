import Foundation

/// Minimal Server-Sent Events parser.
/// Feed one logical line at a time; dispatches (eventType, data) when a blank line is seen.
final class SSEParser {
    typealias Handler = (String?, String) -> Void
    private let handler: Handler
    private var curEvent: String?
    private var curData = ""

    init(handler: @escaping Handler) { self.handler = handler }

    func feed(_ line: String) { handleLine(line) }

    private func handleLine(_ raw: String) {
        let line = raw.hasSuffix("\r") ? String(raw.dropLast()) : raw
        if line.isEmpty {
            if !curData.isEmpty {
                handler(curEvent, curData.trimmingCharacters(in: .whitespacesAndNewlines))
            }
            curEvent = nil
            curData = ""
            return
        }
        if line.hasPrefix(":") { return } // comment
        guard let idx = line.firstIndex(of: ":") else { return }
        let field = String(line[line.startIndex..<idx])
        var value = String(line[line.index(after: idx)...])
        if value.hasPrefix(" ") { value.removeFirst() }
        switch field {
        case "event": curEvent = value
        case "data": curData += (curData.isEmpty ? "" : "\n") + value
        default: break
        }
    }

    func finish() {
        if !curData.isEmpty { handler(curEvent, curData) }
    }
}

extension StreamEvent {
    /// Best-effort mapping from a raw SSE (eventType, data) pair to a typed event.
    static func from(eventType: String?, data: String) -> StreamEvent {
        guard let d = data.data(using: .utf8) else { return .raw(data) }
        let decoder = JSONDecoder()
        let type = eventType
            ?? (try? decoder.decode([String: String].self, from: d))?["type"]
        switch type {
        case "message":
            if let m = try? decoder.decode(Message.self, from: d) { return .message(m) }
        case "part":
            if let p = try? decoder.decode(MessagePart.self, from: d) { return .part(p) }
        case "permission":
            if let p = try? decoder.decode(PermissionRequest.self, from: d) { return .permission(p) }
        case "question":
            if let q = try? decoder.decode(Question.self, from: d) { return .question(q) }
        case "session":
            if let s = try? decoder.decode(Session.self, from: d) { return .session(s) }
        case "summary":
            if let dict = try? decoder.decode([String: String].self, from: d) {
                return .summary(dict["summary"] ?? dict["text"] ?? "")
            }
        case "error":
            if let dict = try? decoder.decode([String: String].self, from: d) {
                return .error(dict["error"] ?? dict["message"] ?? data)
            }
        case "done":
            return .done
        default:
            break
        }
        return .raw(data)
    }
}
