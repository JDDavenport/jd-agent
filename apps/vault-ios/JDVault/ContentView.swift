import SwiftUI

struct ContentView: View {
    @EnvironmentObject var appState: AppState
    @StateObject private var viewModel = HomeViewModel()
    @State private var selectedPage: VaultPage?
    @State private var showingSearch = false
    @State private var showingNewPage = false

    var body: some View {
        NavigationStack {
            HomeView(
                viewModel: viewModel,
                onSelectPage: { page in
                    selectedPage = page
                },
                onCreatePage: {
                    Task {
                        if let newPage = await viewModel.createPage(title: "Untitled") {
                            selectedPage = newPage
                        }
                    }
                },
                onSearch: {
                    showingSearch = true
                }
            )
            .navigationDestination(item: $selectedPage) { page in
                PageDetailView(page: page, onNavigate: { newPage in
                    selectedPage = newPage
                })
            }
            .sheet(isPresented: $showingSearch) {
                SearchView(onSelectPage: { page in
                    showingSearch = false
                    selectedPage = page
                })
            }
        }
        .overlay(alignment: .top) {
            if let error = appState.errorMessage {
                ErrorBanner(message: error)
                    .transition(.move(edge: .top).combined(with: .opacity))
            }
        }
        .overlay(alignment: .top) {
            if !appState.isOnline {
                OfflineBanner()
            }
        }
    }
}

// MARK: - Error Banner
struct ErrorBanner: View {
    let message: String

    var body: some View {
        Text(message)
            .font(.subheadline)
            .foregroundColor(.white)
            .padding(.horizontal, 16)
            .padding(.vertical, 10)
            .background(Color.red)
            .cornerRadius(8)
            .padding(.top, 50)
    }
}

// MARK: - Offline Banner
struct OfflineBanner: View {
    var body: some View {
        HStack {
            Image(systemName: "wifi.slash")
            Text("Offline")
        }
        .font(.caption)
        .foregroundColor(.white)
        .padding(.horizontal, 12)
        .padding(.vertical, 6)
        .background(Color.orange)
        .cornerRadius(12)
        .padding(.top, 50)
    }
}

#Preview {
    ContentView()
        .environmentObject(AppState())
}
