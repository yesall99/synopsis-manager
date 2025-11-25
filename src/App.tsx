import { useEffect } from 'react'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { isFirebaseConfigured } from './config/firebase'
import { useSyncStore } from './stores/syncStore'
import Layout from './components/Layout'
import WorkList from './pages/WorkList'
import WorkDetail from './pages/WorkDetail'
import WorkEdit from './pages/WorkEdit'
import SynopsisEdit from './pages/SynopsisEdit'
import CharacterEdit from './pages/CharacterEdit'
import SettingEdit from './pages/SettingEdit'
import EpisodeEdit from './pages/EpisodeEdit'
import ChapterEdit from './pages/ChapterEdit'
import ChapterManagement from './pages/ChapterManagement'
import TagManagement from './pages/TagManagement'
import Settings from './pages/Settings'

function App() {
  const { initialize } = useSyncStore()

  useEffect(() => {
    // Firebase가 설정되어 있을 때만 초기화
    if (isFirebaseConfigured()) {
      initialize()
    }
  }, [initialize])

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<WorkList />} />
          <Route path="works" element={<WorkList />} />
          <Route path="works/new" element={<WorkEdit />} />
          <Route path="works/:workId/edit" element={<WorkEdit />} />
          <Route path="works/:workId" element={<WorkDetail />} />
          <Route path="works/:workId/synopsis/:id" element={<SynopsisEdit />} />
          <Route path="works/:workId/characters/:id" element={<CharacterEdit />} />
          <Route path="works/:workId/settings/:id" element={<SettingEdit />} />
          <Route path="works/:workId/chapters" element={<ChapterManagement />} />
          <Route path="works/:workId/chapters/:id" element={<ChapterEdit />} />
          <Route path="works/:workId/episodes/:id" element={<EpisodeEdit />} />
          <Route path="tags" element={<TagManagement />} />
          <Route path="settings" element={<Settings />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}

export default App

