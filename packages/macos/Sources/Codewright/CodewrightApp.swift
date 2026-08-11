import SwiftUI

@main
struct CodewrightApp: App {
    @StateObject private var app = AppViewModel()
    @AppStorage("codewright.onboarded") private var onboarded = false

    var body: some Scene {
        WindowGroup {
            ContentView()
                .environmentObject(app)
                .task { await app.connect() }
                .sheet(isPresented: .init(get: { !onboarded }, set: { onboarded = $0 })) {
                    OnboardingView().environmentObject(app)
                }
        }
        .windowResizability(.contentSize)
        .commands {
            CommandGroup(after: .newItem) {
                Button("New Chat") { Task { await app.newSession() } }
                    .keyboardShortcut("n", modifiers: .command)
            }
        }
    }
}
