import SwiftUI

struct ComposerView: View {
    @EnvironmentObject var app: AppViewModel

    private var inputBinding: Binding<String> {
        Binding(
            get: { app.activeSession?.input ?? "" },
            set: { app.activeSession?.input = $0 }
        )
    }

    var body: some View {
        if app.activeSession != nil {
            HStack(alignment: .bottom, spacing: 8) {
                TextField("Message Codewright…", text: inputBinding, axis: .vertical)
                    .textFieldStyle(.plain)
                    .padding(10)
                    .background(.quaternary, in: RoundedRectangle(cornerRadius: 12))
                    .lineLimit(1...10)
                    .onSubmit { Task { await app.activeSession?.send() } }
                Button {
                    Task { await app.activeSession?.send() }
                } label: {
                    Image(systemName: "arrow.up.circle.fill")
                        .font(.title)
                        .foregroundStyle(
                            (app.activeSession?.input ?? "").trimmingCharacters(in: .whitespaces).isEmpty
                            || (app.activeSession?.isStreaming ?? false)
                                ? Color.secondary : Color.accentColor)
                }
                .buttonStyle(.plain)
                .disabled(
                    (app.activeSession?.input ?? "").trimmingCharacters(in: .whitespaces).isEmpty
                    || (app.activeSession?.isStreaming ?? false)
                )
                .keyboardShortcut(.return, modifiers: .command)
            }
            .padding(12)
        }
    }
}
