import Foundation
import SwiftUI

@MainActor
final class SessionViewModel: ObservableObject {
    let sessionID: String
    let client: APIClient

    @Published var messages: [Message] = []
    @Published var permissionRequests: [PermissionRequest] = []
    @Published var questions: [Question] = []
    @Published var isStreaming = false
    @Published var input = ""
    @Published var cost: Double?
    @Published var errorMessage: String?

    private var liveMessageID: String?

    init(sessionID: String, client: APIClient) {
        self.sessionID = sessionID
        self.client = client
    }

    func loadHistory() async {
        do { messages = try await client.listMessages(sessionID) }
        catch { errorMessage = error.localizedDescription }
    }

    func send() async {
        let text = input.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !text.isEmpty, !isStreaming else { return }
        input = ""
        isStreaming = true
        let userMsg = Message(id: "u-\(UUID())", sessionID: sessionID, role: "user",
                              time: Date().timeIntervalSince1970, cost: nil, tokens: nil,
                              parts: [MessagePart(id: nil, type: "text", text: text, tool: nil, state: nil, name: nil)])
        messages.append(userMsg)
        do {
            try await client.sendPrompt(sessionID: sessionID, text: text) { [weak self] ev in
                Task { @MainActor in self?.handle(ev) }
            }
        } catch {
            isStreaming = false
            errorMessage = error.localizedDescription
        }
    }

    private func handle(_ ev: StreamEvent) {
        switch ev {
        case .message(let m):
            upsert(m); liveMessageID = nil
        case .part(let p):
            appendPart(p)
        case .permission(let req):
            if !permissionRequests.contains(where: { $0.id == req.id }) { permissionRequests.append(req) }
        case .question(let q):
            if !questions.contains(where: { $0.id == q.id }) { questions.append(q) }
        case .done:
            isStreaming = false; liveMessageID = nil
            Task { await reloadMeta() }
        case .error(let e):
            isStreaming = false; errorMessage = e
        default:
            break
        }
    }

    private func upsert(_ m: Message) {
        if let idx = messages.firstIndex(where: { $0.id == m.id }) { messages[idx] = m }
        else { messages.append(m) }
    }

    private func appendPart(_ p: MessagePart) {
        let id = liveMessageID ?? "live-\(sessionID)"
        if liveMessageID == nil {
            let base = Message(id: id, sessionID: sessionID, role: "assistant",
                               time: nil, cost: nil, tokens: nil, parts: [p])
            messages.append(base)
            liveMessageID = id
        } else if let idx = messages.firstIndex(where: { $0.id == id }) {
            var m = messages[idx]
            m.parts = (m.parts ?? []) + [p]
            messages[idx] = m
        }
    }

    func replyPermission(_ req: PermissionRequest, decision: String, always: Bool) async {
        do {
            try await client.replyPermission(sessionID: sessionID, requestID: req.id, decision: decision, always: always)
            permissionRequests.removeAll { $0.id == req.id }
        } catch { errorMessage = error.localizedDescription }
    }

    func answerQuestion(_ q: Question, answer: String) async {
        // The web client answers questions through the same permission/question reply
        // flow; here we acknowledge locally and surface the answer back to the agent
        // via a lightweight prompt so the session continues.
        questions.removeAll { $0.id == q.id }
        input = answer
        await send()
    }

    func interrupt() async {
        try? await client.interrupt(sessionID)
        isStreaming = false
    }

    func revert() async {
        try? await client.revert(sessionID)
        await loadHistory()
    }

    private func reloadMeta() async {
        if let s = try? await client.getSession(sessionID) { cost = s.cost }
    }
}
