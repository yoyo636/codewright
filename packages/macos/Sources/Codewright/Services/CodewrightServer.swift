import Foundation
import SwiftUI

/// Manages the lifecycle of a local `codewright serve` process, or attaches to a
/// server already running elsewhere.
@MainActor
final class CodewrightServer: ObservableObject {
    @Published var state: ServerState = .stopped
    @Published var logLines: [String] = []

    private var process: Process?

    enum ServerState: Equatable {
        case stopped, starting, running, failed(String)
    }

    /// Resolve the `codewright` executable using a login shell so ~/.bun/bin is on PATH.
    private func resolveExecutable() -> String? {
        let script = "source ~/.zshrc 2>/dev/null; source ~/.bash_profile 2>/dev/null; which codewright"
        let proc = Process()
        proc.executableURL = URL(fileURLWithPath: "/bin/bash")
        proc.arguments = ["-lc", script]
        let pipe = Pipe()
        proc.standardOutput = pipe
        try? proc.run()
        proc.waitUntilExit()
        if let out = String(data: pipe.fileHandleForReading.readDataToEndOfFile(), encoding: .utf8) {
            let trimmed = out.trimmingCharacters(in: .whitespacesAndNewlines)
            if !trimmed.isEmpty, trimmed.hasPrefix("/") { return trimmed }
        }
        let fallback = ("\(NSHomeDirectory())/.bun/bin/codewright")
        return FileManager.default.fileExists(atPath: fallback) ? fallback : nil
    }

    func launch(port: Int) async {
        guard process == nil else { return }
        state = .starting
        guard let exec = resolveExecutable() else {
            state = .failed("codewright not found on PATH. Run `bun link` in the codewright repo.")
            return
        }
        let proc = Process()
        proc.executableURL = URL(fileURLWithPath: exec)
        proc.arguments = ["serve", "--port", "\(port)", "--hostname", "127.0.0.1"]
        let out = Pipe()
        let err = Pipe()
        proc.standardOutput = out
        proc.standardError = err
        proc.terminationHandler = { [weak self] _ in
            Task { @MainActor in self?.state = .stopped }
        }
        do {
            try proc.run()
            process = proc
            state = .running
            readLogs(out)
            readLogs(err)
        } catch {
            state = .failed(error.localizedDescription)
        }
    }

    private func readLogs(_ pipe: Pipe) {
        let handle = pipe.fileHandleForReading
        handle.readabilityHandler = { [weak self] fh in
            let data = fh.availableData
            if let line = String(data: data, encoding: .utf8), !line.isEmpty {
                Task { @MainActor in
                    self?.logLines.append(line)
                    if self?.logLines.count ?? 0 > 200 { self?.logLines.removeFirst() }
                }
            }
        }
    }

    func stop() {
        process?.terminate()
        process = nil
        state = .stopped
    }
}
