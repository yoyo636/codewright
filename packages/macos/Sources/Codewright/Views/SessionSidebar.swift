import SwiftUI

struct SessionSidebar: View {
    @EnvironmentObject var app: AppViewModel

    var body: some View {
        List(selection: $app.selectedSessionID) {
            ForEach(app.sessions) { s in
                SessionRow(s: s)
                    .tag(s.id as String?)
                    .contentShape(Rectangle())
                    .onTapGesture {
                        app.selectedSessionID = s.id
                        Task { await app.select(sessionID: s.id) }
                    }
            }
        }
        .navigationTitle("Chats")
        .overlay { if app.sessions.isEmpty { EmptyChats } }
        .safeAreaInset(edge: .bottom) {
            HStack(spacing: 8) {
                StatusDot(status: app.connectionStatus)
                Text(statusText).font(.caption).foregroundStyle(.secondary)
                Spacer()
                Button { Task { await app.newSession() } } label: {
                    Image(systemName: "plus.circle.fill").font(.title3)
                }.buttonStyle(.plain).help("New chat")
            }
            .padding(.horizontal, 12).padding(.vertical, 8)
            .background(.bar)
        }
    }

    private var statusText: String {
        switch app.connectionStatus {
        case .disconnected: return "Disconnected"
        case .connecting: return "Connecting…"
        case .connected: return "Connected"
        case .error: return "Error"
        }
    }

    private var EmptyChats: some View {
        VStack(spacing: 10) {
            Image(systemName: "bubble.left.and.bubble.right").font(.largeTitle).foregroundStyle(.secondary)
            Text("No chats yet").font(.headline)
            Button("Start a chat") { Task { await app.newSession() } }
                .buttonStyle(.borderedProminent)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }
}

struct SessionRow: View {
    let s: Session
    var body: some View {
        VStack(alignment: .leading, spacing: 3) {
            Text(s.title).font(.headline).lineLimit(1)
            HStack(spacing: 6) {
                if let a = s.agent { Text(a).font(.caption2).foregroundStyle(.tint) }
                if let c = s.cost, c > 0 {
                    Spacer()
                    Text(String(format: "$%.3f", c)).font(.caption2).foregroundStyle(.secondary)
                }
            }
            Text(s.directory).font(.caption2).foregroundStyle(.tertiary).lineLimit(1)
        }
        .padding(.vertical, 4)
    }
}

struct StatusDot: View {
    let status: AppViewModel.ConnectionStatus
    var body: some View {
        Circle()
            .fill(color)
            .frame(width: 9, height: 9)
            .overlay(Circle().stroke(.secondary.opacity(0.3), lineWidth: 1))
    }
    private var color: Color {
        switch status {
        case .connected: return .green
        case .connecting: return .orange
        case .error: return .red
        case .disconnected: return .gray
        }
    }
}
