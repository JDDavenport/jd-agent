import { useEffect, useMemo, useState } from 'react'

type FeedSort = 'hot' | 'new' | 'top'
type TimeRange = 'hour' | 'day' | 'week' | 'month' | 'year' | 'all'

interface GroupRule {
  title: string
  description?: string
}

interface Group {
  id: string
  name: string
  displayTitle: string
  description?: string
  subscriberCount: number
  is21Plus: boolean
  rules?: GroupRule[]
  creatorId?: string | null
}

interface Post {
  id: string
  title: string
  contentType: string
  contentUrl?: string
  contentText?: string
  thumbnailUrl?: string
  is21Plus: boolean
  isOriginalContent: boolean
  upvotes: number
  downvotes: number
  commentCount: number
  createdAt: string
}

interface FeedItem {
  post: Post
  groupName?: string
  groupTitle?: string
}

interface Comment {
  id: string
  content: string
}

type SearchScope = 'posts' | 'groups' | 'users'

const API_BASE = (import.meta as ImportMeta).env?.VITE_SOS_API_URL || '/api/v1/sosatisfying'

const formatScore = (upvotes: number, downvotes: number) => upvotes - downvotes

const normalizeGroupName = (value: string) =>
  value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, '-')
    .replace(/-+/g, '-')

interface UserProfile {
  id: string
  username: string
  email: string
  ageVerified21Plus: boolean
  isAdmin?: boolean
  walletAddress?: string
  karma?: number
}

const formatRelativeTime = (iso: string) => {
  const date = new Date(iso)
  const diffMs = Date.now() - date.getTime()
  const minutes = Math.floor(diffMs / 60000)
  if (minutes < 1) return 'just now'
  if (minutes < 60) return `${minutes}m`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h`
  const days = Math.floor(hours / 24)
  return `${days}d`
}

export default function App() {
  const [groups, setGroups] = useState<Group[]>([])
  const [feed, setFeed] = useState<FeedItem[]>([])
  const [selectedGroup, setSelectedGroup] = useState<string | null>(null)
  const [sort, setSort] = useState<FeedSort>('hot')
  const [timeRange, setTimeRange] = useState<TimeRange>('day')
  const [groupSearch, setGroupSearch] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isPostModalOpen, setIsPostModalOpen] = useState(false)
  const [isGroupModalOpen, setIsGroupModalOpen] = useState(false)
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false)
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login')
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(null)
  const [isModQueueOpen, setIsModQueueOpen] = useState(false)
  const [modQueue, setModQueue] = useState<any[]>([])
  const [isAgeGateOpen, setIsAgeGateOpen] = useState(false)
  const [ageGateGroup, setAgeGateGroup] = useState<Group | null>(null)
  const [anonymousAgeVerified, setAnonymousAgeVerified] = useState(false)
  const [isBugModalOpen, setIsBugModalOpen] = useState(false)
  const [bugStatus, setBugStatus] = useState<string | null>(null)
  const [isSettingsOpen, setIsSettingsOpen] = useState(false)
  const [isAdminOpen, setIsAdminOpen] = useState(false)
  const [adSpaces, setAdSpaces] = useState<any[]>([])
  const [isAdModalOpen, setIsAdModalOpen] = useState(false)
  const [selectedAdSpace, setSelectedAdSpace] = useState<string | null>(null)
  const [adminUsers, setAdminUsers] = useState<any[]>([])
  const [rankingSettings, setRankingSettings] = useState({
    hotDecayHours: 24,
    voteWeight: 1,
    commentWeight: 0.2,
  })
  const [adminAdSpaceForm, setAdminAdSpaceForm] = useState({
    name: '',
    placement: 'frontpage-banner',
    priceCents: 0,
  })
  const [authForm, setAuthForm] = useState({
    username: '',
    email: '',
    password: '',
  })
  const [postForm, setPostForm] = useState({
    title: '',
    contentType: 'link',
    contentUrl: '',
    contentText: '',
    groupId: '',
    is21Plus: false,
    isOriginalContent: false,
  })
  const [groupForm, setGroupForm] = useState({
    name: '',
    displayTitle: '',
    description: '',
    category: '',
    contentRating: 'all',
  })
  const [commentsByPost, setCommentsByPost] = useState<Record<string, Comment[]>>({})
  const [loadingComments, setLoadingComments] = useState<Record<string, boolean>>({})
  const [searchQuery, setSearchQuery] = useState('')
  const [searchScope, setSearchScope] = useState<SearchScope>('posts')
  const [searchResults, setSearchResults] = useState<any[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const [bugForm, setBugForm] = useState({
    title: '',
    description: '',
    severity: 'medium',
    userEmail: '',
  })
  const [adForm, setAdForm] = useState({
    title: '',
    imageUrl: '',
    clickUrl: '',
    isAdult: false,
  })

  useEffect(() => {
    const storedUser = localStorage.getItem('sos_user')
    if (storedUser) {
      setCurrentUser(JSON.parse(storedUser))
    }
    const storedAge = localStorage.getItem('sos_age_verified')
    if (storedAge === 'true') {
      setAnonymousAgeVerified(true)
    }
  }, [])

  const feedQuery = useMemo(() => {
    const params = new URLSearchParams({ sort, timeRange })
    if (selectedGroup) params.set('group', selectedGroup)
    return params.toString()
  }, [sort, selectedGroup, timeRange])

  const filteredGroups = useMemo(() => {
    if (!groupSearch.trim()) return groups
    const query = groupSearch.toLowerCase()
    return groups.filter((group) => group.name.toLowerCase().includes(query))
  }, [groupSearch, groups])

  const selectedGroupData = useMemo(
    () => (selectedGroup ? groups.find((group) => group.name === selectedGroup) : null),
    [selectedGroup, groups]
  )

  const feedWithAds = useMemo(() => {
    if (feed.length === 0) return []
    const result: Array<FeedItem | { kind: 'ad'; id: string }> = []
    feed.forEach((item, index) => {
      result.push(item)
      if ((index + 1) % 6 === 0) {
        result.push({ kind: 'ad', id: `ad-${index}` })
      }
    })
    return result
  }, [feed])

  useEffect(() => {
    const load = async () => {
      try {
        setIsLoading(true)
        setError(null)

        const [groupsRes, feedRes] = await Promise.all([
          fetch(`${API_BASE}/groups?limit=50`),
          fetch(`${API_BASE}/feed?${feedQuery}`),
        ])

        const groupsJson = await groupsRes.json()
        const feedJson = await feedRes.json()

        if (!groupsJson.success || !feedJson.success) {
          throw new Error('Failed to load SoSatisfying data')
        }

        setGroups(groupsJson.data)
        setFeed(feedJson.data)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unexpected error')
      } finally {
        setIsLoading(false)
      }
    }

    load()
  }, [feedQuery])

  useEffect(() => {
    loadAdSpaces()
  }, [])

  const refreshFeed = async () => {
    const feedRes = await fetch(`${API_BASE}/feed?${feedQuery}`)
    const feedJson = await feedRes.json()
    if (feedJson.success) {
      setFeed(feedJson.data)
    }
  }

  const refreshGroups = async () => {
    const groupsRes = await fetch(`${API_BASE}/groups?limit=50`)
    const groupsJson = await groupsRes.json()
    if (groupsJson.success) {
      setGroups(groupsJson.data)
    }
  }

  const loadAdSpaces = async () => {
    const res = await fetch(`${API_BASE}/ad-spaces`)
    const json = await res.json()
    if (json.success) {
      setAdSpaces(json.data)
    }
  }

  const loadAdminUsers = async () => {
    if (!currentUser?.isAdmin) return
    const res = await fetch(`${API_BASE}/admin/users?adminUserId=${currentUser.id}`)
    const json = await res.json()
    if (json.success) {
      setAdminUsers(json.data)
    }
  }

  const loadRankingSettings = async () => {
    if (!currentUser?.isAdmin) return
    const res = await fetch(`${API_BASE}/admin/ranking?adminUserId=${currentUser.id}`)
    const json = await res.json()
    if (json.success) {
      setRankingSettings({
        hotDecayHours: json.data.hotDecayHours ?? 24,
        voteWeight: json.data.voteWeight ?? 1,
        commentWeight: json.data.commentWeight ?? 0.2,
      })
    }
  }

  const handleCreateGroup = async () => {
    if (!currentUser) {
      setAuthMode('login')
      setIsAuthModalOpen(true)
      return
    }
    const payload = {
      name: normalizeGroupName(groupForm.name),
      displayTitle: groupForm.displayTitle,
      description: groupForm.description || undefined,
      category: groupForm.category || undefined,
      contentRating: groupForm.contentRating,
      creatorId: currentUser.id,
    }

    const res = await fetch(`${API_BASE}/groups`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    const json = await res.json()
    if (json.success) {
      setIsGroupModalOpen(false)
      setGroupForm({ name: '', displayTitle: '', description: '', category: '', contentRating: 'all' })
      await refreshGroups()
    } else {
      setError(json.error?.message || 'Failed to create group')
    }
  }

  const handleCreatePost = async () => {
    if (!currentUser) {
      setAuthMode('login')
      setIsAuthModalOpen(true)
      return
    }
    if (!postForm.groupId) return
    const payload = {
      groupId: postForm.groupId,
      authorId: currentUser.id,
      title: postForm.title,
      contentType: postForm.contentType,
      contentUrl: postForm.contentType === 'text' ? undefined : postForm.contentUrl,
      contentText: postForm.contentType === 'text' ? postForm.contentText : undefined,
      is21Plus: postForm.is21Plus,
      isOriginalContent: postForm.isOriginalContent,
    }

    const res = await fetch(`${API_BASE}/posts`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    const json = await res.json()
    if (json.success) {
      setIsPostModalOpen(false)
      setPostForm({
        title: '',
        contentType: 'link',
        contentUrl: '',
        contentText: '',
        groupId: '',
        is21Plus: false,
        isOriginalContent: false,
      })
      await refreshFeed()
    } else {
      setError(json.error?.message || 'Failed to create post')
    }
  }

  const handleVote = async (postId: string, value: 1 | -1) => {
    if (!currentUser) {
      setAuthMode('login')
      setIsAuthModalOpen(true)
      return
    }
    await fetch(`${API_BASE}/posts/${postId}/vote`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: currentUser.id, value }),
    })
    await refreshFeed()
  }

  const handleLoadComments = async (postId: string) => {
    setLoadingComments((prev) => ({ ...prev, [postId]: true }))
    const res = await fetch(`${API_BASE}/posts/${postId}/comments?limit=20`)
    const json = await res.json()
    if (json.success) {
      setCommentsByPost((prev) => ({ ...prev, [postId]: json.data }))
    }
    setLoadingComments((prev) => ({ ...prev, [postId]: false }))
  }

  const handleAddComment = async (postId: string) => {
    if (!currentUser) {
      setAuthMode('login')
      setIsAuthModalOpen(true)
      return
    }
    const content = window.prompt('Add a comment')
    if (!content) return
    await fetch(`${API_BASE}/posts/${postId}/comments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ authorId: currentUser.id, content }),
    })
    await handleLoadComments(postId)
    await refreshFeed()
  }

  const handleReport = async (payload: { postId?: string; commentId?: string }) => {
    const reason = window.prompt('Report reason')
    if (!reason) return
    const details = window.prompt('Additional details (optional)') || undefined
    await fetch(`${API_BASE}/reports`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...payload,
        reporterId: currentUser?.id,
        reason,
        details,
      }),
    })
    if (currentUser) {
      await loadModQueue()
    }
  }

  const loadModQueue = async () => {
    const res = await fetch(`${API_BASE}/reports?status=pending`)
    const json = await res.json()
    if (json.success) {
      setModQueue(json.data)
    }
  }

  const handleUpdateReport = async (reportId: string, status: 'reviewed' | 'actioned') => {
    if (!currentUser) return
    await fetch(`${API_BASE}/reports/${reportId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status, reviewedBy: currentUser.id }),
    })
    await loadModQueue()
  }

  const handleLogin = async () => {
    const res = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: authForm.email,
        password: authForm.password,
      }),
    })
    const json = await res.json()
    if (json.success) {
      setCurrentUser(json.data)
      localStorage.setItem('sos_user', JSON.stringify(json.data))
      setIsAuthModalOpen(false)
    } else {
      setError(json.error?.message || 'Login failed')
    }
  }

  const handleRegister = async () => {
    const res = await fetch(`${API_BASE}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(authForm),
    })
    const json = await res.json()
    if (json.success) {
      setCurrentUser(json.data)
      localStorage.setItem('sos_user', JSON.stringify(json.data))
      setIsAuthModalOpen(false)
    } else {
      setError(json.error?.message || 'Registration failed')
    }
  }

  const handleSignOut = () => {
    setCurrentUser(null)
    localStorage.removeItem('sos_user')
  }

  const handleAgeVerify = async () => {
    if (currentUser) {
      const res = await fetch(`${API_BASE}/users/${currentUser.id}/age-verify`, { method: 'POST' })
      const json = await res.json()
      if (json.success) {
        const updatedUser = { ...currentUser, ageVerified21Plus: true }
        setCurrentUser(updatedUser)
        localStorage.setItem('sos_user', JSON.stringify(updatedUser))
      }
    } else {
      setAnonymousAgeVerified(true)
      localStorage.setItem('sos_age_verified', 'true')
    }
    setIsAgeGateOpen(false)
  }

  const handleSubmitBug = async () => {
    setBugStatus(null)
    const payload = {
      reporterId: currentUser?.id,
      title: bugForm.title,
      description: bugForm.description,
      severity: bugForm.severity,
      pageUrl: window.location.href,
      userEmail: bugForm.userEmail || currentUser?.email,
    }

    const res = await fetch(`${API_BASE}/bug-reports`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    const json = await res.json()
    if (json.success) {
      setBugStatus('Bug submitted. Thank you!')
      setBugForm({ title: '', description: '', severity: 'medium', userEmail: '' })
      setIsBugModalOpen(false)
    } else {
      setBugStatus(json.error?.message || 'Failed to submit bug')
    }
  }

  const handleUpdateWallet = async () => {
    if (!currentUser) return
    const res = await fetch(`${API_BASE}/users/${currentUser.id}/wallet`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ walletAddress: currentUser.walletAddress }),
    })
    const json = await res.json()
    if (json.success) {
      const updatedUser = { ...currentUser, walletAddress: json.data.walletAddress }
      setCurrentUser(updatedUser)
      localStorage.setItem('sos_user', JSON.stringify(updatedUser))
      setIsSettingsOpen(false)
    }
  }

  const handleBuyAdSpace = async (adSpaceId: string) => {
    const res = await fetch(`${API_BASE}/ad-spaces/${adSpaceId}/buy`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ buyerUserId: currentUser?.id }),
    })
    const json = await res.json()
    if (!json.success) {
      setError(json.error?.message || 'Failed to buy ad space')
    }
  }

  const handleCreateAd = async () => {
    if (!selectedAdSpace) return
    const res = await fetch(`${API_BASE}/ad-spaces/${selectedAdSpace}/ads`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ownerUserId: currentUser?.id,
        title: adForm.title,
        imageUrl: adForm.imageUrl || undefined,
        clickUrl: adForm.clickUrl || undefined,
        isAdult: adForm.isAdult,
      }),
    })
    const json = await res.json()
    if (json.success) {
      setIsAdModalOpen(false)
      setAdForm({ title: '', imageUrl: '', clickUrl: '', isAdult: false })
    } else {
      setError(json.error?.message || 'Failed to create ad')
    }
  }

  const handleCreateAdSpaceForGroup = async (groupId: string) => {
    if (!currentUser) return
    const res = await fetch(`${API_BASE}/ad-spaces`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: `r/${selectedGroupData?.name} sidebar`,
        placement: 'sidebar-rect',
        groupId,
        ownerUserId: currentUser.id,
      }),
    })
    const json = await res.json()
    if (json.success) {
      await loadAdSpaces()
    } else {
      setError(json.error?.message || 'Failed to create ad space')
    }
  }

  const handleBanUser = async (userId: string) => {
    if (!currentUser?.isAdmin) return
    await fetch(`${API_BASE}/admin/users/${userId}/ban`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ adminUserId: currentUser.id }),
    })
    await loadAdminUsers()
  }

  const handleBlockPost = async (postId: string) => {
    if (!currentUser?.isAdmin) return
    await fetch(`${API_BASE}/admin/posts/${postId}/block`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ adminUserId: currentUser.id }),
    })
    await refreshFeed()
  }

  const handleSaveRanking = async () => {
    if (!currentUser?.isAdmin) return
    await fetch(`${API_BASE}/admin/ranking`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...rankingSettings, adminUserId: currentUser.id }),
    })
  }

  const handleCreateAdminAdSpace = async () => {
    if (!currentUser?.isAdmin) return
    const res = await fetch(`${API_BASE}/ad-spaces`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: adminAdSpaceForm.name,
        placement: adminAdSpaceForm.placement,
        priceCents: Number(adminAdSpaceForm.priceCents || 0),
        adminUserId: currentUser.id,
      }),
    })
    const json = await res.json()
    if (json.success) {
      setAdminAdSpaceForm({ name: '', placement: 'frontpage-banner', priceCents: 0 })
      await loadAdSpaces()
    }
  }

  useEffect(() => {
    if (selectedGroupData?.is21Plus) {
      const isVerified = currentUser?.ageVerified21Plus || anonymousAgeVerified
      if (!isVerified) {
        setAgeGateGroup(selectedGroupData)
        setIsAgeGateOpen(true)
      }
    }
  }, [selectedGroupData, currentUser, anonymousAgeVerified])

  const handleSearch = async () => {
    if (!searchQuery.trim()) {
      setSearchResults([])
      return
    }
    setIsSearching(true)
    const res = await fetch(
      `${API_BASE}/search?query=${encodeURIComponent(searchQuery.trim())}&scope=${searchScope}`
    )
    const json = await res.json()
    if (json.success) {
      setSearchResults(json.data)
    }
    setIsSearching(false)
  }

  return (
    <div className="min-h-screen">
      <header className="bg-white border-b border-gray-200 sticky top-0 z-20">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center gap-4">
          <div className="text-xl font-bold text-orange-600">SoSatisfying</div>
          <div className="flex-1 flex items-center gap-2">
            <input
              className="flex-1 border border-gray-200 rounded-md px-3 py-2 text-sm"
              placeholder="Search posts, groups, users"
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  handleSearch()
                }
              }}
            />
            <select
              className="border border-gray-200 rounded-md px-2 py-2 text-xs"
              value={searchScope}
              onChange={(event) => setSearchScope(event.target.value as SearchScope)}
            >
              <option value="posts">Posts</option>
              <option value="groups">Groups</option>
              <option value="users">Users</option>
            </select>
            <button className="text-sm text-blue-600" onClick={handleSearch}>
              Search
            </button>
          </div>
          {currentUser ? (
            <div className="flex items-center gap-3 text-sm">
              <button
                className="bg-orange-600 text-white text-sm px-4 py-2 rounded-md"
                onClick={() => setIsPostModalOpen(true)}
              >
                Create Post
              </button>
              <button className="text-gray-500" onClick={() => setIsModQueueOpen(true)}>
                Mod Queue
              </button>
              <button className="text-gray-500" onClick={() => setIsBugModalOpen(true)}>
                Report Bug
              </button>
              <button className="text-gray-500" onClick={() => setIsSettingsOpen(true)}>
                Settings
              </button>
              {currentUser.isAdmin && (
                <button
                  className="text-gray-500"
                  onClick={() => {
                    setIsAdminOpen(true)
                    loadAdminUsers()
                    loadRankingSettings()
                  }}
                >
                  Admin
                </button>
              )}
              <span className="text-gray-600">u/{currentUser.username}</span>
              {typeof currentUser.karma === 'number' && (
                <span className="text-gray-400">karma {currentUser.karma}</span>
              )}
              <button className="text-gray-400" onClick={handleSignOut}>
                Sign out
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-3 text-sm">
              <button
                className="bg-orange-600 text-white text-sm px-4 py-2 rounded-md"
                onClick={() => {
                  setAuthMode('login')
                  setIsAuthModalOpen(true)
                }}
              >
                Sign in
              </button>
              <button className="text-gray-500" onClick={() => setIsBugModalOpen(true)}>
                Report Bug
              </button>
            </div>
          )}
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-6 grid grid-cols-12 gap-6">
        <aside className="col-span-3 hidden lg:block">
          <div className="sos-card p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold">Groups</h2>
              <button
                className="text-xs text-blue-600"
                onClick={() => setIsGroupModalOpen(true)}
              >
                Create
              </button>
            </div>
            <input
              className="w-full border border-gray-200 rounded-md px-2 py-1 text-sm"
              placeholder="Search groups"
              value={groupSearch}
              onChange={(event) => setGroupSearch(event.target.value)}
            />
            <div className="space-y-2 max-h-[70vh] overflow-auto">
              <button
                className={`w-full text-left text-sm px-2 py-1 rounded ${
                  selectedGroup === null ? 'bg-orange-50 text-orange-700' : 'hover:bg-gray-50'
                }`}
                onClick={() => setSelectedGroup(null)}
              >
                All posts
              </button>
              {filteredGroups.map((group) => (
                <button
                  key={group.id}
                  className={`w-full text-left text-sm px-2 py-1 rounded ${
                    selectedGroup === group.name ? 'bg-orange-50 text-orange-700' : 'hover:bg-gray-50'
                  }`}
                  onClick={() => setSelectedGroup(group.name)}
                >
                  r/{group.name}
                  <span className="ml-2 text-xs text-gray-500">{group.subscriberCount}</span>
                </button>
              ))}
            </div>
          </div>
        </aside>

        <section className="col-span-12 lg:col-span-6 space-y-4">
          <div className="sos-card p-3 flex flex-wrap items-center gap-3 text-sm">
            <span className="text-gray-500">Sort</span>
            {(['hot', 'new', 'top'] as FeedSort[]).map((mode) => (
              <button
                key={mode}
                className={`px-3 py-1 rounded ${
                  sort === mode ? 'bg-orange-100 text-orange-700' : 'hover:bg-gray-50'
                }`}
                onClick={() => setSort(mode)}
              >
                {mode}
              </button>
            ))}
            <span className="text-gray-500 ml-2">Range</span>
            {(['hour', 'day', 'week', 'month', 'year', 'all'] as TimeRange[]).map((range) => (
              <button
                key={range}
                className={`px-3 py-1 rounded ${
                  timeRange === range ? 'bg-orange-100 text-orange-700' : 'hover:bg-gray-50'
                }`}
                onClick={() => setTimeRange(range)}
              >
                {range}
              </button>
            ))}
            {selectedGroup && (
              <span className="sos-pill">r/{selectedGroup}</span>
            )}
          </div>

          {isSearching && (
            <div className="sos-card p-4 text-sm text-gray-500">Searching...</div>
          )}

          {!isSearching && searchResults.length > 0 && (
            <div className="sos-card p-4 space-y-2">
              <div className="text-xs uppercase text-gray-500">Search Results</div>
              {searchScope === 'groups' &&
                searchResults.map((group) => (
                  <button
                    key={group.id}
                    className="w-full text-left text-sm text-gray-700 hover:text-orange-600"
                    onClick={() => setSelectedGroup(group.name)}
                  >
                    r/{group.name}
                  </button>
                ))}
              {searchScope === 'users' &&
                searchResults.map((user) => (
                  <div key={user.id} className="text-sm text-gray-700">
                    u/{user.username}
                  </div>
                ))}
              {searchScope === 'posts' &&
                searchResults.map((item) => (
                  <div key={item.post.id} className="text-sm text-gray-700">
                    {item.post.title}
                  </div>
                ))}
            </div>
          )}

          {isLoading && (
            <div className="sos-card p-6 text-sm text-gray-500">Loading feed...</div>
          )}

          {error && (
            <div className="sos-card p-6 text-sm text-red-600 space-y-2">
              <div>{error}</div>
              <div className="text-xs text-gray-500">
                If the API is offline, run <span className="font-semibold">bun run sosatisfying:api</span> and ensure
                <span className="font-semibold"> SOS_DATABASE_URL</span> is set.
              </div>
            </div>
          )}

          {!isLoading && !error && feed.length === 0 && (
            <div className="sos-card p-6 text-sm text-gray-500">
              No posts yet. Create the first satisfying post.
            </div>
          )}

          {!isLoading && !error && feedWithAds.map((item) => {
            if ('kind' in item) {
              return (
                <article key={item.id} className="sos-card p-4 border border-orange-100 bg-orange-50/40">
                  <div className="text-xs uppercase text-orange-600 font-semibold mb-2">Sponsored</div>
                  <div className="text-sm text-gray-700">Gadz.io placement (placeholder)</div>
                </article>
              )
            }

            const { post, groupName, groupTitle } = item
            return (
              <article key={post.id} className="sos-card p-4 flex gap-4">
                <div className="flex flex-col items-center text-sm text-gray-500">
                  <button className="text-orange-600" onClick={() => handleVote(post.id, 1)}>▲</button>
                  <span className="font-semibold">{formatScore(post.upvotes, post.downvotes)}</span>
                  <button className="text-blue-500" onClick={() => handleVote(post.id, -1)}>▼</button>
                </div>
                <div className="flex-1 space-y-2">
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold text-base">{post.title}</h3>
                    {post.is21Plus && <span className="sos-pill">21+</span>}
                    {post.isOriginalContent && <span className="sos-pill">OC</span>}
                    <span className="sos-pill">{post.contentType}</span>
                  </div>
                  <div className="text-xs text-gray-500 flex flex-wrap gap-2">
                    <span>r/{groupName || 'unknown'}</span>
                    {groupTitle && <span className="sos-pill">{groupTitle}</span>}
                    <span>{formatRelativeTime(post.createdAt)}</span>
                    <span>{post.commentCount} comments</span>
                  </div>
                  {post.thumbnailUrl && (
                    <img
                      src={post.thumbnailUrl}
                      alt=""
                      className="w-full max-h-64 object-cover rounded-md border border-gray-200"
                    />
                  )}
                  {post.contentUrl && (
                    <a href={post.contentUrl} className="text-sm text-blue-600" target="_blank" rel="noreferrer">
                      {post.contentUrl}
                    </a>
                  )}
                  {post.contentText && (
                    <p className="text-sm text-gray-700 whitespace-pre-line">{post.contentText}</p>
                  )}
                  <div className="flex items-center gap-3 text-xs text-blue-600">
                    <button onClick={() => handleLoadComments(post.id)}>View comments</button>
                    <button onClick={() => handleAddComment(post.id)}>Add comment</button>
                    <button onClick={() => handleReport({ postId: post.id })}>Report</button>
                    {currentUser?.isAdmin && (
                      <button onClick={() => handleBlockPost(post.id)}>Block post</button>
                    )}
                  </div>
                  {loadingComments[post.id] && (
                    <div className="text-xs text-gray-400">Loading comments...</div>
                  )}
                  {commentsByPost[post.id]?.length > 0 && (
                    <div className="space-y-2">
                      {commentsByPost[post.id].map((comment) => (
                        <div key={comment.id} className="text-sm text-gray-700 border-l border-gray-200 pl-3">
                          {comment.content}
                          <button
                            className="ml-2 text-xs text-blue-600"
                            onClick={() => handleReport({ commentId: comment.id })}
                          >
                            Report
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </article>
            )
          })}
        </section>

        <aside className="col-span-3 hidden lg:block space-y-4">
          {selectedGroupData ? (
            <div className="sos-card p-4 space-y-3">
              <div>
                <h3 className="font-semibold text-base">r/{selectedGroupData.name}</h3>
                <p className="text-xs text-gray-500">{selectedGroupData.displayTitle}</p>
              </div>
              {selectedGroupData.description && (
                <p className="text-sm text-gray-600">{selectedGroupData.description}</p>
              )}
              <div className="text-xs text-gray-500">
                {selectedGroupData.subscriberCount} subscribers
              </div>
              <div className="space-y-2">
                <h4 className="text-sm font-semibold">Rules</h4>
                {(selectedGroupData.rules || []).length === 0 && (
                  <p className="text-xs text-gray-500">No custom rules yet.</p>
                )}
                {(selectedGroupData.rules || []).map((rule, index) => (
                  <div key={`${rule.title}-${index}`} className="text-xs text-gray-600">
                    <div className="font-semibold">{index + 1}. {rule.title}</div>
                    {rule.description && <div>{rule.description}</div>}
                  </div>
                ))}
              </div>
              {currentUser && selectedGroupData.creatorId === currentUser.id && (
                <button
                  className="text-xs text-blue-600"
                  onClick={() => handleCreateAdSpaceForGroup(selectedGroupData.id)}
                >
                  Create Ad Space for this group
                </button>
              )}
            </div>
          ) : (
            <div className="sos-card p-4 space-y-2">
              <h3 className="font-semibold">Trending Groups</h3>
              {groups.slice(0, 6).map((group) => (
                <button
                  key={group.id}
                  className="w-full text-left text-sm text-gray-700 hover:text-orange-600"
                  onClick={() => setSelectedGroup(group.name)}
                >
                  r/{group.name}
                </button>
              ))}
            </div>
          )}

          <div className="sos-card p-4 space-y-2">
            <div className="text-xs uppercase text-orange-600 font-semibold">Sponsored</div>
            <div className="text-sm text-gray-600">Gadz.io 300x250 slot</div>
          </div>

          <div className="sos-card p-4 space-y-2">
            <div className="text-xs uppercase text-orange-600 font-semibold">Sponsored</div>
            <div className="text-sm text-gray-600">Gadz.io 300x600 slot</div>
          </div>

          <div className="sos-card p-4 space-y-2">
            <div className="text-xs uppercase text-gray-500">Ad Marketplace</div>
            {adSpaces.length === 0 && <div className="text-sm text-gray-500">No ad spaces yet.</div>}
            {adSpaces.map((space) => (
              <div key={space.id} className="text-sm text-gray-700 space-y-1">
                <div>{space.name}</div>
                <div className="text-xs text-gray-500">{space.placement}</div>
                <div className="flex gap-2 text-xs text-blue-600">
                  <button onClick={() => handleBuyAdSpace(space.id)}>Buy</button>
                  {currentUser?.id && space.ownerUserId === currentUser.id && (
                    <button
                      onClick={() => {
                        setSelectedAdSpace(space.id)
                        setIsAdModalOpen(true)
                      }}
                    >
                      Create Ad
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </aside>
      </main>

      {isPostModalOpen && (
        <div className="sos-modal-backdrop">
          <div className="sos-modal">
            <h3 className="text-lg font-semibold mb-3">Create Post</h3>
            <div className="space-y-3">
              <select
                className="w-full border border-gray-200 rounded-md px-3 py-2 text-sm"
                value={postForm.groupId}
                onChange={(event) => setPostForm((prev) => ({ ...prev, groupId: event.target.value }))}
              >
                <option value="">Select group</option>
                {groups.map((group) => (
                  <option key={group.id} value={group.id}>
                    r/{group.name}
                  </option>
                ))}
              </select>
              <input
                className="w-full border border-gray-200 rounded-md px-3 py-2 text-sm"
                placeholder="Title"
                value={postForm.title}
                onChange={(event) => setPostForm((prev) => ({ ...prev, title: event.target.value }))}
              />
              <select
                className="w-full border border-gray-200 rounded-md px-3 py-2 text-sm"
                value={postForm.contentType}
                onChange={(event) => setPostForm((prev) => ({ ...prev, contentType: event.target.value }))}
              >
                <option value="link">Link</option>
                <option value="text">Text</option>
                <option value="image">Image</option>
                <option value="video">Video</option>
                <option value="gallery">Gallery</option>
              </select>
              {postForm.contentType === 'text' ? (
                <textarea
                  className="w-full border border-gray-200 rounded-md px-3 py-2 text-sm"
                  rows={4}
                  placeholder="Write your post"
                  value={postForm.contentText}
                  onChange={(event) => setPostForm((prev) => ({ ...prev, contentText: event.target.value }))}
                />
              ) : (
                <input
                  className="w-full border border-gray-200 rounded-md px-3 py-2 text-sm"
                  placeholder="Content URL"
                  value={postForm.contentUrl}
                  onChange={(event) => setPostForm((prev) => ({ ...prev, contentUrl: event.target.value }))}
                />
              )}
              <label className="flex items-center gap-2 text-sm text-gray-600">
                <input
                  type="checkbox"
                  checked={postForm.is21Plus}
                  onChange={(event) => setPostForm((prev) => ({ ...prev, is21Plus: event.target.checked }))}
                />
                21+ content
              </label>
              <label className="flex items-center gap-2 text-sm text-gray-600">
                <input
                  type="checkbox"
                  checked={postForm.isOriginalContent}
                  onChange={(event) => setPostForm((prev) => ({ ...prev, isOriginalContent: event.target.checked }))}
                />
                Original content
              </label>
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <button className="text-sm text-gray-500" onClick={() => setIsPostModalOpen(false)}>
                Cancel
              </button>
              <button className="bg-orange-600 text-white text-sm px-4 py-2 rounded-md" onClick={handleCreatePost}>
                Publish
              </button>
            </div>
          </div>
        </div>
      )}

      {isGroupModalOpen && (
        <div className="sos-modal-backdrop">
          <div className="sos-modal">
            <h3 className="text-lg font-semibold mb-3">Create Group</h3>
            <div className="space-y-3">
              <input
                className="w-full border border-gray-200 rounded-md px-3 py-2 text-sm"
                placeholder="Group name (lowercase)"
                value={groupForm.name}
                onChange={(event) => setGroupForm((prev) => ({ ...prev, name: event.target.value }))}
              />
              <input
                className="w-full border border-gray-200 rounded-md px-3 py-2 text-sm"
                placeholder="Display title"
                value={groupForm.displayTitle}
                onChange={(event) => setGroupForm((prev) => ({ ...prev, displayTitle: event.target.value }))}
              />
              <input
                className="w-full border border-gray-200 rounded-md px-3 py-2 text-sm"
                placeholder="Category"
                value={groupForm.category}
                onChange={(event) => setGroupForm((prev) => ({ ...prev, category: event.target.value }))}
              />
              <textarea
                className="w-full border border-gray-200 rounded-md px-3 py-2 text-sm"
                rows={3}
                placeholder="Description"
                value={groupForm.description}
                onChange={(event) => setGroupForm((prev) => ({ ...prev, description: event.target.value }))}
              />
              <select
                className="w-full border border-gray-200 rounded-md px-3 py-2 text-sm"
                value={groupForm.contentRating}
                onChange={(event) => setGroupForm((prev) => ({ ...prev, contentRating: event.target.value }))}
              >
                <option value="all">All ages</option>
                <option value="21+">21+</option>
              </select>
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <button className="text-sm text-gray-500" onClick={() => setIsGroupModalOpen(false)}>
                Cancel
              </button>
              <button className="bg-orange-600 text-white text-sm px-4 py-2 rounded-md" onClick={handleCreateGroup}>
                Create
              </button>
            </div>
          </div>
        </div>
      )}

      {isAuthModalOpen && (
        <div className="sos-modal-backdrop">
          <div className="sos-modal">
            <h3 className="text-lg font-semibold mb-3">
              {authMode === 'login' ? 'Sign in' : 'Create account'}
            </h3>
            <div className="space-y-3">
              {authMode === 'register' && (
                <input
                  className="w-full border border-gray-200 rounded-md px-3 py-2 text-sm"
                  placeholder="Username"
                  value={authForm.username}
                  onChange={(event) => setAuthForm((prev) => ({ ...prev, username: event.target.value }))}
                />
              )}
              <input
                className="w-full border border-gray-200 rounded-md px-3 py-2 text-sm"
                placeholder="Email"
                value={authForm.email}
                onChange={(event) => setAuthForm((prev) => ({ ...prev, email: event.target.value }))}
              />
              <input
                type="password"
                className="w-full border border-gray-200 rounded-md px-3 py-2 text-sm"
                placeholder="Password"
                value={authForm.password}
                onChange={(event) => setAuthForm((prev) => ({ ...prev, password: event.target.value }))}
              />
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <button className="text-sm text-gray-500" onClick={() => setIsAuthModalOpen(false)}>
                Cancel
              </button>
              {authMode === 'login' ? (
                <button className="bg-orange-600 text-white text-sm px-4 py-2 rounded-md" onClick={handleLogin}>
                  Sign in
                </button>
              ) : (
                <button className="bg-orange-600 text-white text-sm px-4 py-2 rounded-md" onClick={handleRegister}>
                  Create account
                </button>
              )}
            </div>
            <div className="mt-3 text-xs text-gray-500">
              {authMode === 'login' ? (
                <button onClick={() => setAuthMode('register')}>Need an account? Register</button>
              ) : (
                <button onClick={() => setAuthMode('login')}>Already have an account? Sign in</button>
              )}
            </div>
          </div>
        </div>
      )}

      {isAgeGateOpen && ageGateGroup && (
        <div className="sos-modal-backdrop">
          <div className="sos-modal">
            <h3 className="text-lg font-semibold mb-3">21+ Content Warning</h3>
            <p className="text-sm text-gray-600">
              r/{ageGateGroup.name} is marked 21+. Confirm you are 21 or older to continue.
            </p>
            <div className="mt-4 flex justify-end gap-2">
              <button
                className="text-sm text-gray-500"
                onClick={() => {
                  setIsAgeGateOpen(false)
                  setSelectedGroup(null)
                }}
              >
                Back
              </button>
              <button className="bg-orange-600 text-white text-sm px-4 py-2 rounded-md" onClick={handleAgeVerify}>
                I am 21+
              </button>
            </div>
          </div>
        </div>
      )}

      {isModQueueOpen && (
        <div className="sos-modal-backdrop">
          <div className="sos-modal">
            <h3 className="text-lg font-semibold mb-3">Moderation Queue</h3>
            <button className="text-xs text-blue-600 mb-3" onClick={loadModQueue}>
              Refresh
            </button>
            {modQueue.length === 0 && <div className="text-sm text-gray-500">No pending reports.</div>}
            <div className="space-y-2">
              {modQueue.map((report) => (
                <div key={report.id} className="border border-gray-200 rounded-md p-2 text-sm">
                  <div className="text-gray-700">{report.reason}</div>
                  {report.details && <div className="text-xs text-gray-500">{report.details}</div>}
                  <div className="mt-2 flex gap-2 text-xs">
                    <button
                      className="text-blue-600"
                      onClick={() => handleUpdateReport(report.id, 'reviewed')}
                    >
                      Mark reviewed
                    </button>
                    <button
                      className="text-orange-600"
                      onClick={() => handleUpdateReport(report.id, 'actioned')}
                    >
                      Actioned
                    </button>
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-4 flex justify-end">
              <button className="text-sm text-gray-500" onClick={() => setIsModQueueOpen(false)}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {isBugModalOpen && (
        <div className="sos-modal-backdrop">
          <div className="sos-modal">
            <h3 className="text-lg font-semibold mb-3">Report a Bug</h3>
            <div className="space-y-3">
              <input
                className="w-full border border-gray-200 rounded-md px-3 py-2 text-sm"
                placeholder="Title"
                value={bugForm.title}
                onChange={(event) => setBugForm((prev) => ({ ...prev, title: event.target.value }))}
              />
              <textarea
                className="w-full border border-gray-200 rounded-md px-3 py-2 text-sm"
                rows={4}
                placeholder="What happened?"
                value={bugForm.description}
                onChange={(event) => setBugForm((prev) => ({ ...prev, description: event.target.value }))}
              />
              <div className="flex gap-2">
                <select
                  className="border border-gray-200 rounded-md px-2 py-2 text-sm"
                  value={bugForm.severity}
                  onChange={(event) => setBugForm((prev) => ({ ...prev, severity: event.target.value }))}
                >
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                </select>
                <input
                  className="flex-1 border border-gray-200 rounded-md px-3 py-2 text-sm"
                  placeholder="Email (optional)"
                  value={bugForm.userEmail}
                  onChange={(event) => setBugForm((prev) => ({ ...prev, userEmail: event.target.value }))}
                />
              </div>
            </div>
            {bugStatus && <div className="text-xs text-gray-500 mt-2">{bugStatus}</div>}
            <div className="mt-4 flex justify-end gap-2">
              <button className="text-sm text-gray-500" onClick={() => setIsBugModalOpen(false)}>
                Cancel
              </button>
              <button className="bg-orange-600 text-white text-sm px-4 py-2 rounded-md" onClick={handleSubmitBug}>
                Send
              </button>
            </div>
          </div>
        </div>
      )}

      {isSettingsOpen && currentUser && (
        <div className="sos-modal-backdrop">
          <div className="sos-modal">
            <h3 className="text-lg font-semibold mb-3">User Settings</h3>
            <div className="space-y-3">
              <input
                className="w-full border border-gray-200 rounded-md px-3 py-2 text-sm"
                placeholder="Wallet address"
                value={currentUser.walletAddress || ''}
                onChange={(event) => setCurrentUser({ ...currentUser, walletAddress: event.target.value })}
              />
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <button className="text-sm text-gray-500" onClick={() => setIsSettingsOpen(false)}>
                Cancel
              </button>
              <button className="bg-orange-600 text-white text-sm px-4 py-2 rounded-md" onClick={handleUpdateWallet}>
                Save
              </button>
            </div>
          </div>
        </div>
      )}

      {isAdModalOpen && (
        <div className="sos-modal-backdrop">
          <div className="sos-modal">
            <h3 className="text-lg font-semibold mb-3">Create Ad</h3>
            <div className="space-y-3">
              <input
                className="w-full border border-gray-200 rounded-md px-3 py-2 text-sm"
                placeholder="Title"
                value={adForm.title}
                onChange={(event) => setAdForm((prev) => ({ ...prev, title: event.target.value }))}
              />
              <input
                className="w-full border border-gray-200 rounded-md px-3 py-2 text-sm"
                placeholder="Image URL"
                value={adForm.imageUrl}
                onChange={(event) => setAdForm((prev) => ({ ...prev, imageUrl: event.target.value }))}
              />
              <input
                className="w-full border border-gray-200 rounded-md px-3 py-2 text-sm"
                placeholder="Click URL"
                value={adForm.clickUrl}
                onChange={(event) => setAdForm((prev) => ({ ...prev, clickUrl: event.target.value }))}
              />
              <label className="flex items-center gap-2 text-sm text-gray-600">
                <input
                  type="checkbox"
                  checked={adForm.isAdult}
                  onChange={(event) => setAdForm((prev) => ({ ...prev, isAdult: event.target.checked }))}
                />
                Adult content
              </label>
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <button className="text-sm text-gray-500" onClick={() => setIsAdModalOpen(false)}>
                Cancel
              </button>
              <button className="bg-orange-600 text-white text-sm px-4 py-2 rounded-md" onClick={handleCreateAd}>
                Submit
              </button>
            </div>
          </div>
        </div>
      )}

      {isAdminOpen && currentUser?.isAdmin && (
        <div className="sos-modal-backdrop">
          <div className="sos-modal">
            <h3 className="text-lg font-semibold mb-3">Admin Panel</h3>
            <div className="space-y-4">
              <div>
                <h4 className="text-sm font-semibold mb-2">Capabilities</h4>
                <ul className="text-xs text-gray-600 space-y-1">
                  <li>Moderate reports, block posts/users</li>
                  <li>Adjust ranking weights</li>
                  <li>Manage ad placements</li>
                </ul>
              </div>
              <div className="space-y-2">
                <h4 className="text-sm font-semibold">Ranking</h4>
                <input
                  className="w-full border border-gray-200 rounded-md px-3 py-2 text-sm"
                  type="number"
                  value={rankingSettings.hotDecayHours}
                  onChange={(event) =>
                    setRankingSettings((prev) => ({ ...prev, hotDecayHours: Number(event.target.value) }))
                  }
                  placeholder="Hot decay hours"
                />
                <input
                  className="w-full border border-gray-200 rounded-md px-3 py-2 text-sm"
                  type="number"
                  value={rankingSettings.voteWeight}
                  onChange={(event) =>
                    setRankingSettings((prev) => ({ ...prev, voteWeight: Number(event.target.value) }))
                  }
                  placeholder="Vote weight"
                />
                <input
                  className="w-full border border-gray-200 rounded-md px-3 py-2 text-sm"
                  type="number"
                  value={rankingSettings.commentWeight}
                  onChange={(event) =>
                    setRankingSettings((prev) => ({ ...prev, commentWeight: Number(event.target.value) }))
                  }
                  placeholder="Comment weight"
                />
                <button className="text-sm text-blue-600" onClick={handleSaveRanking}>
                  Save ranking
                </button>
              </div>
              <div className="space-y-2">
                <h4 className="text-sm font-semibold">Ad Spaces</h4>
                <input
                  className="w-full border border-gray-200 rounded-md px-3 py-2 text-sm"
                  placeholder="Name"
                  value={adminAdSpaceForm.name}
                  onChange={(event) => setAdminAdSpaceForm((prev) => ({ ...prev, name: event.target.value }))}
                />
                <select
                  className="w-full border border-gray-200 rounded-md px-3 py-2 text-sm"
                  value={adminAdSpaceForm.placement}
                  onChange={(event) => setAdminAdSpaceForm((prev) => ({ ...prev, placement: event.target.value }))}
                >
                  <option value="frontpage-banner">Frontpage Banner</option>
                  <option value="sidebar-rect">Sidebar Rectangle</option>
                  <option value="in-feed">In-feed</option>
                </select>
                <input
                  className="w-full border border-gray-200 rounded-md px-3 py-2 text-sm"
                  type="number"
                  value={adminAdSpaceForm.priceCents}
                  onChange={(event) =>
                    setAdminAdSpaceForm((prev) => ({ ...prev, priceCents: Number(event.target.value) }))
                  }
                  placeholder="Price (cents)"
                />
                <button className="text-sm text-blue-600" onClick={handleCreateAdminAdSpace}>
                  Create ad space
                </button>
              </div>
              <div className="space-y-2">
                <h4 className="text-sm font-semibold">Users</h4>
                {adminUsers.map((user) => (
                  <div key={user.id} className="flex items-center justify-between text-sm text-gray-600">
                    <span>u/{user.username}</span>
                    {!user.isBanned && (
                      <button className="text-xs text-red-600" onClick={() => handleBanUser(user.id)}>
                        Ban
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
            <div className="mt-4 flex justify-end">
              <button className="text-sm text-gray-500" onClick={() => setIsAdminOpen(false)}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
