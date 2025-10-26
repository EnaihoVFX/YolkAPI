#!/bin/bash

echo "🔨 Building RealPay Concordium contract..."

# Navigate to contract directory
cd contracts/realpay

# Check if cargo is installed
if ! command -v cargo &> /dev/null; then
    echo "❌ Cargo not found. Please install Rust and Cargo first."
    echo "Visit: https://rustup.rs/"
    exit 1
fi

# Install concordium-std if not already installed
echo "📦 Installing concordium-std..."
cargo add concordium-std

# Build the contract
echo "🏗️  Building contract..."
cargo concordium build --release

# Check if build was successful
if [ $? -eq 0 ]; then
    echo "✅ Contract built successfully!"
    echo "WASM file location: target/wasm32-unknown-unknown/release/realpay.wasm"
else
    echo "❌ Contract build failed!"
    exit 1
fi

# Go back to project root
cd ../..

echo "🎉 Build complete! Ready for deployment."

