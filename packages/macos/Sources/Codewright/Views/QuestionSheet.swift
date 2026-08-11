import SwiftUI

/// Inline banner for agent questions that need a user answer before continuing.
struct QuestionBanner: View {
    @EnvironmentObject var app: AppViewModel

    var body: some View {
        if let vm = app.activeSession, !vm.questions.isEmpty {
            VStack(alignment: .leading, spacing: 8) {
                Label("Codewright asked", systemImage: "questionmark.circle.fill")
                    .font(.caption.bold())
                    .foregroundStyle(.blue)
                ForEach(vm.questions) { q in
                    QuestionRow(q: q)
                }
            }
            .padding(12)
            .background(.blue.opacity(0.10))
            .clipShape(RoundedRectangle(cornerRadius: 12))
            .padding(.horizontal, 12)
        }
    }
}

struct QuestionRow: View {
    @EnvironmentObject var app: AppViewModel
    let q: Question
    @State private var answer = ""

    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            Text(q.question ?? "A response is required to continue.")
                .font(.caption)
                .textSelection(.enabled)
            if let opts = q.options, !opts.isEmpty {
                ScrollView(.horizontal, showsIndicators: false) {
                    HStack(spacing: 6) {
                        ForEach(opts, id: \.self) { opt in
                            Button(opt) { Task { await app.activeSession?.answerQuestion(q, answer: opt) } }
                                .buttonStyle(.bordered)
                                .controlSize(.small)
                        }
                    }
                    .padding(3)
                }
            }
            HStack {
                TextField("Type your answer…", text: $answer, axis: .vertical)
                    .textFieldStyle(.roundedBorder)
                    .lineLimit(1...4)
                    .onSubmit { Task { await app.activeSession?.answerQuestion(q, answer: answer) } }
                Button("Send") { Task { await app.activeSession?.answerQuestion(q, answer: answer) } }
                    .buttonStyle(.borderedProminent)
                    .controlSize(.small)
                    .disabled(answer.trimmingCharacters(in: .whitespaces).isEmpty)
            }
        }
        .padding(10)
        .background(.thickMaterial, in: RoundedRectangle(cornerRadius: 10))
    }
}
