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

  # SHA256 digests are taken from the GitHub release assets for this version.
  # To update them for a new release, run:
  #   shasum -a 256 <archive.zip|archive.tar.gz>

  on_macos do
    if Hardware::CPU.intel?
      url "https://github.com/yoyo636/codewright/releases/download/v#{version}/codewright-darwin-x64.zip"
      sha256 "b8faf9adcc36bb731defe1859f8958b30fceed733779d60b0f520c6e34ae642d"
    end

    if Hardware::CPU.arm?
      url "https://github.com/yoyo636/codewright/releases/download/v#{version}/codewright-darwin-arm64.zip"
      sha256 "b966b04b86a98321b106ac09936471e46f14a883f44a6c0696a7dfe384d37d9b"
    end
  end

  on_linux do
    if Hardware::CPU.intel? && Hardware::CPU.is_64_bit?
      url "https://github.com/yoyo636/codewright/releases/download/v#{version}/codewright-linux-x64.tar.gz"
      sha256 "55d880c8dc10223ff717bf3e76a89744b0889c0e9c2e34f7280cbeced1862cb6"
    end

    if Hardware::CPU.arm? && Hardware::CPU.is_64_bit?
      url "https://github.com/yoyo636/codewright/releases/download/v#{version}/codewright-linux-arm64.tar.gz"
      sha256 "c216dd896e47eafbf476010b0bcda6de52b49d901822443448938bab0d133edf"
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