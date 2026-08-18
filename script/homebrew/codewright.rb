# typed: strict
# frozen_string_literal: true

# Homebrew formula for codewright - AI coding agent (terminal edition)
#
# Install:
#   brew tap yoyo636/codewright https://github.com/yoyo636/codewright.git
#   brew install codewright
#
# Or from a local checkout:
#   brew install --build-from-source script/homebrew/codewright.rb
#
# Dependencies:
#   - ripgrep (rg) - required for code search (recommended)

class Codewright < Formula
  desc "AI coding agent for the terminal"
  homepage "https://github.com/yoyo636/codewright"
  license "MIT"
  version "3.0.1-beta"

  # The SHA256 placeholders below must be updated for each release.
  # You can compute them with:
  #   shasum -a 256 <archive.tar.gz>

  on_macos do
    if Hardware::CPU.intel?
      url "https://github.com/yoyo636/codewright/releases/download/v#{version}/codewright-macos-x64.tar.gz"
      sha256 "PLACEHOLDER_MACOS_X64_SHA256"
    end

    if Hardware::CPU.arm?
      url "https://github.com/yoyo636/codewright/releases/download/v#{version}/codewright-macos-arm64.tar.gz"
      sha256 "PLACEHOLDER_MACOS_ARM64_SHA256"
    end
  end

  on_linux do
    if Hardware::CPU.intel? && Hardware::CPU.is_64_bit?
      url "https://github.com/yoyo636/codewright/releases/download/v#{version}/codewright-linux-x64.tar.gz"
      sha256 "PLACEHOLDER_LINUX_X64_SHA256"
    end

    if Hardware::CPU.arm? && Hardware::CPU.is_64_bit?
      url "https://github.com/yoyo636/codewright/releases/download/v#{version}/codewright-linux-arm64.tar.gz"
      sha256 "PLACEHOLDER_LINUX_ARM64_SHA256"
    end
  end

  depends_on "ripgrep" => :recommended

  def install
    bin.install "codewright"

    # Generate shell completions
    generate_completions_from_executable(bin/"codewright", "completion")
  end

  test do
    assert_match "codewright", shell_output("#{bin}/codewright --version")
  end
end