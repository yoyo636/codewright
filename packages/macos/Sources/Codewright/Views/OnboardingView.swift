import SwiftUI
import UniformTypeIdentifiers

struct OnboardingView: View {
    @EnvironmentObject var app: AppViewModel
    @Environment(\.dismiss) private var dismiss

    @State private var draft: AppConfig = .init()
    @State private var showDirPicker = false

    var body: some View {
        VStack(spacing: 18) {
            Image(systemName: "brain.head.profile")
                .font(.system(size: 56)).foregroundStyle(.tint)
            Text("Welcome to Codewright").font(.largeTitle.bold())
            Text("A native macOS client for the Codewright coding agent.")
                .foregroundStyle(.secondary)

            Form {
                Toggle("Launch a local agent server on start", isOn: $draft.launchLocalServer)
                HStack {
                    Text("Working directory")
                    Spacer()
                    TextField("path", text: $draft.defaultDirectory).frame(width: 240)
                    Button("Choose…") { showDirPicker = true }
                }
                Picker("Approval mode", selection: $draft.approvalMode) {
                    ForEach(AppConfig.ApprovalMode.allCases, id: \.self) { m in
                        Text(m.label).tag(m)
                    }
                }
                SecureField("Provider API key (optional)", text: $draft.apiKey)
                    .textFieldStyle(.roundedBorder)
            }
            .frame(width: 460)

            Button("Get started") {
                app.config = draft
                dismiss()
                Task { await app.connect() }
            }
            .buttonStyle(.borderedProminent)
            .controlSize(.large)
        }
        .padding(40)
        .frame(width: 560, height: 600)
        .onAppear { draft = app.config }
        .fileImporter(isPresented: $showDirPicker, allowedContentTypes: [.folder], allowsMultipleSelection: false) { res in
            if case .success(let urls) = res, let u = urls.first { draft.defaultDirectory = u.path }
        }
    }
}
