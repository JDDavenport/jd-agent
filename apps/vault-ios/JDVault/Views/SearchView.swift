import SwiftUI

struct SearchView: View {
    let onSelectPage: (VaultPage) -> Void

    @State private var searchText = ""
    @State private var results: [VaultPage] = []
    @State private var isSearching = false
    @State private var recentSearches: [String] = []
    @Environment(\.dismiss) private var dismiss

    private let apiClient = APIClient.shared

    var body: some View {
        NavigationStack {
            VStack(spacing: 0) {
                // Search bar
                searchBar

                // Results or suggestions
                if searchText.isEmpty {
                    suggestionsView
                } else {
                    resultsView
                }
            }
            .navigationTitle("Search")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarLeading) {
                    Button("Cancel") {
                        dismiss()
                    }
                }
            }
        }
    }

    // MARK: - Search Bar
    private var searchBar: some View {
        HStack {
            Image(systemName: "magnifyingglass")
                .foregroundColor(.secondary)

            TextField("Search pages...", text: $searchText)
                .textFieldStyle(.plain)
                .autocorrectionDisabled()
                .onChange(of: searchText) { _, newValue in
                    performSearch(query: newValue)
                }

            if !searchText.isEmpty {
                Button(action: { searchText = "" }) {
                    Image(systemName: "xmark.circle.fill")
                        .foregroundColor(.secondary)
                }
            }

            if isSearching {
                ProgressView()
                    .scaleEffect(0.8)
            }
        }
        .padding(.horizontal, 12)
        .padding(.vertical, 10)
        .background(Color(.systemGray6))
        .cornerRadius(10)
        .padding()
    }

    // MARK: - Suggestions View
    private var suggestionsView: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 16) {
                if !recentSearches.isEmpty {
                    VStack(alignment: .leading, spacing: 8) {
                        Text("Recent Searches")
                            .font(.caption)
                            .fontWeight(.semibold)
                            .foregroundColor(.secondary)
                            .textCase(.uppercase)

                        ForEach(recentSearches, id: \.self) { search in
                            Button(action: { searchText = search }) {
                                HStack {
                                    Image(systemName: "clock.arrow.circlepath")
                                        .foregroundColor(.secondary)
                                    Text(search)
                                        .foregroundColor(.primary)
                                    Spacer()
                                }
                                .padding(.vertical, 8)
                            }
                        }
                    }
                    .padding(.horizontal)
                }

                VStack(alignment: .leading, spacing: 8) {
                    Text("Tips")
                        .font(.caption)
                        .fontWeight(.semibold)
                        .foregroundColor(.secondary)
                        .textCase(.uppercase)
                        .padding(.horizontal)

                    tipRow(icon: "doc.text", text: "Search by page title")
                    tipRow(icon: "text.magnifyingglass", text: "Search page content")
                }
            }
            .padding(.vertical)
        }
    }

    // MARK: - Results View
    private var resultsView: some View {
        ScrollView {
            LazyVStack(spacing: 0) {
                if results.isEmpty && !isSearching && !searchText.isEmpty {
                    VStack(spacing: 12) {
                        Image(systemName: "magnifyingglass")
                            .font(.system(size: 48))
                            .foregroundColor(.secondary)

                        Text("No results for \"\(searchText)\"")
                            .font(.headline)

                        Text("Try a different search term")
                            .font(.subheadline)
                            .foregroundColor(.secondary)

                        Button(action: { createNewPage() }) {
                            Label("Create \"\(searchText)\"", systemImage: "plus")
                        }
                        .buttonStyle(.borderedProminent)
                        .padding(.top, 8)
                    }
                    .padding(.vertical, 40)
                } else {
                    ForEach(results) { page in
                        Button(action: {
                            saveRecentSearch(searchText)
                            onSelectPage(page)
                        }) {
                            HStack(spacing: 12) {
                                Text(page.icon ?? "📄")
                                    .font(.title2)

                                VStack(alignment: .leading, spacing: 2) {
                                    Text(page.title.isEmpty ? "Untitled" : page.title)
                                        .font(.body)
                                        .foregroundColor(.primary)
                                        .lineLimit(1)

                                    Text(page.updatedAt.formatted(.relative(presentation: .named)))
                                        .font(.caption)
                                        .foregroundColor(.secondary)
                                }

                                Spacer()

                                if page.isFavorite {
                                    Image(systemName: "star.fill")
                                        .foregroundColor(.yellow)
                                        .font(.caption)
                                }
                            }
                            .padding(.horizontal)
                            .padding(.vertical, 12)
                        }
                        .buttonStyle(.plain)

                        Divider()
                            .padding(.leading, 56)
                    }
                }
            }
        }
    }

    // MARK: - Tip Row
    private func tipRow(icon: String, text: String) -> some View {
        HStack {
            Image(systemName: icon)
                .foregroundColor(.blue)
                .frame(width: 24)

            Text(text)
                .foregroundColor(.secondary)
        }
        .padding(.horizontal)
        .padding(.vertical, 6)
    }

    // MARK: - Search
    private func performSearch(query: String) {
        guard !query.isEmpty else {
            results = []
            return
        }

        isSearching = true

        Task {
            do {
                let searchResults = try await apiClient.searchPages(query: query)
                await MainActor.run {
                    results = searchResults
                    isSearching = false
                }
            } catch {
                print("[Search] Error: \(error)")
                await MainActor.run {
                    isSearching = false
                }
            }
        }
    }

    // MARK: - Create New Page
    private func createNewPage() {
        Task {
            do {
                let input = CreatePageInput(title: searchText, parentId: nil, icon: nil)
                let page = try await apiClient.createPage(input: input)
                await MainActor.run {
                    onSelectPage(page)
                }
            } catch {
                print("[Search] Error creating page: \(error)")
            }
        }
    }

    // MARK: - Recent Searches
    private func saveRecentSearch(_ search: String) {
        guard !search.isEmpty else { return }
        var searches = recentSearches
        searches.removeAll { $0 == search }
        searches.insert(search, at: 0)
        recentSearches = Array(searches.prefix(5))
    }
}

#Preview {
    SearchView(onSelectPage: { _ in })
}
