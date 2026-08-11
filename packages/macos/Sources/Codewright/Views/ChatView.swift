import SwiftUI

struct ChatView: View {
    @EnvironmentObject var app: AppViewModel

    var body: some View {
        if let vm = app.activeSession {
            VStack(spacing: 0) {
                ScrollViewReader { proxy in
                    ScrollView {
                        LazyVStack(alignment: .leading, spacing: 12) {
                            ForEach(vm.messages) { m in
                                MessageBubble(m: m).id(m.id)
                            }
                        }
                        .padding(16)
                    }
                    .onChange(of: vm.messages.count) { _, _ in
                        if let last = vm.messages.last {
                            withAnimation { proxy.scrollTo(last.id, anchor: .bottom) }
                        }
                    }
                }
                PermissionBanner().environmentObject(app)
                QuestionBanner().environmentObject(app)
                Divider()
                ComposerView().environmentObject(app)
            }
            .navigationTitle("Chat")
            .toolbar {
                ToolbarItem {
                    Button { Task { await vm.interrupt() } } label: {
                        Label("Stop", systemImage: "stop.fill")
                    }
                    .disabled(!vm.isStreaming)
                    .help("Interrupt (stop generation)")
                }
                ToolbarItem {
                    Button { Task { await vm.revert() } } label: {
                        Label("Undo", systemImage: "arrow.uturn.backward")
                    }
                    .help("Revert last change (/undo)")
                }
            }
        } else {
            VStack(spacing: 14) {
                Image(systemName: "bubble.left.and.bubble.right")
                    .font(.system(size: 44)).foregroundStyle(.secondary)
                Text("No chat selected").font(.title3.bold())
                Text("Pick a chat from the sidebar or start a new one.")
                    .foregroundStyle(.secondary)
                Button("New chat") { Task { await app.newSession() } }
                    .buttonStyle(.borderedProminent)
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity)
        }
    }
}
