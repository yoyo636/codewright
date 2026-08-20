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
  version "3.0.2-beta"

  # SHA256 digests are taken from the GitHub release assets for this version.
  # To update them for a new release, run:
  #   shasum -a 256 <archive.zip|archive.tar.gz>

  on_macos do
    if Hardware::CPU.intel?
      url "https://github.com/yoyo636/codewright/releases/download/v#{version}/codewright-darwin-x64.zip"
      sha256 "4e52a68f41372f67c90fccfdc344b30c3f360ad8c242ba85c3f6d5a56f1fd246"
    end

    if Hardware::CPU.arm?
      url "https://github.com/yoyo636/codewright/releases/download/v#{version}/codewright-darwin-arm64.zip"
      sha256 "9b32de0b224082096d67ee29b8a18e67a3ddcd43b2d15e7c146b6690242bd804"
    end
  end

  on_linux do
    if Hardware::CPU.intel? && Hardware::CPU.is_64_bit?
      url "https://github.com/yoyo636/codewright/releases/download/v#{version}/codewright-linux-x64.tar.gz"
      sha256 "37bc634c9ba54dad7722184bd69719b0a52aba91e180385a40ebde929a67d245"
    end

    if Hardware::CPU.arm? && Hardware::CPU.is_64_bit?
      url "https://github.com/yoyo636/codewright/releases/download/v#{version}/codewright-linux-arm64.tar.gz"
      sha256 "4793e7a40174fcc6fdedadaf1f20c6d2c9a56503d541d4be1de332b145b259ed"
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