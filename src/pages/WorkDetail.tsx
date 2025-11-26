import { useEffect, useState } from 'react'
import { useParams, useNavigate, Link, Outlet, useLocation } from 'react-router-dom'
import { ArrowLeft, Plus, Loader2, BookOpen, Users, Settings, Edit2, Trash2, Download, FileText, BarChart3 } from 'lucide-react'
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core'
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { useWorkStore } from '@/stores/workStore'
import { useSynopsisStore } from '@/stores/synopsisStore'
import { useCharacterStore } from '@/stores/characterStore'
import { useSettingStore } from '@/stores/settingStore'
import { useTagStore } from '@/stores/tagStore'
import { useEpisodeStore } from '@/stores/episodeStore'
import { useChapterStore } from '@/stores/chapterStore'
// import SynopsisCard from '@/components/SynopsisCard' // 사용하지 않음
import CharacterCard from '@/components/CharacterCard'
import SettingCard from '@/components/SettingCard'
import WorkExportDialog from '@/components/WorkExportDialog'

type TabType = 'synopsis' | 'characters' | 'settings' | 'episodes'

export default function WorkDetail() {
  const { workId } = useParams<{ workId: string }>()
  const navigate = useNavigate()
  const location = useLocation()
  const { currentWork, isLoading, loadWork, deleteWork } = useWorkStore()
  const { synopses, loadSynopses } = useSynopsisStore()
  const { characters, loadCharacters } = useCharacterStore()
  const { settings, loadSettings } = useSettingStore()
  const { tags, loadTags } = useTagStore()
  const { episodes, loadEpisodes } = useEpisodeStore()
  const { chapters, loadChapters } = useChapterStore()
  const [activeTab, setActiveTab] = useState<TabType>('synopsis')
  const [episodeSubTab, setEpisodeSubTab] = useState<'list' | 'episodeStats' | 'serialStats'>('list')
  const [isExportDialogOpen, setIsExportDialogOpen] = useState(false)
  
  // localStorage에서 설정 불러오기
  const [episodeDisplayInterval, setEpisodeDisplayIntervalState] = useState<number>(() => {
    const saved = localStorage.getItem('episodeDisplayInterval')
    return saved ? Number(saved) : 1
  })
  const [episodeSortOrder, setEpisodeSortOrderState] = useState<'asc' | 'desc'>(() => {
    const saved = localStorage.getItem('episodeSortOrder')
    return (saved === 'asc' || saved === 'desc') ? saved : 'asc'
  })
  
  // 설정 저장 함수
  const setEpisodeDisplayInterval = (value: number) => {
    setEpisodeDisplayIntervalState(value)
    localStorage.setItem('episodeDisplayInterval', String(value))
  }
  
  const setEpisodeSortOrder = (value: 'asc' | 'desc') => {
    setEpisodeSortOrderState(value)
    localStorage.setItem('episodeSortOrder', value)
  }

  // location state에서 탭 정보를 받아서 설정
  useEffect(() => {
    if (location.state?.tab) {
      setActiveTab(location.state.tab as TabType)
    }
  }, [location.state])

  useEffect(() => {
    if (workId) {
      loadWork(workId)
      loadSynopses()
      loadCharacters()
      loadSettings()
      loadTags()
      loadEpisodes()
      loadChapters()
    }
  }, [workId, loadWork, loadSynopses, loadCharacters, loadSettings, loadTags, loadEpisodes, loadChapters])

  const workSynopses = synopses.filter((s) => s.workId === workId)
  const workCharacters = characters
    .filter((c) => c.workId === workId)
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
  const workSettings = settings
    .filter((s) => s.workId === workId)
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
  // 장도 회차 정렬 순서에 따라 정렬
  const workChaptersBase = chapters
    .filter((c) => c.workId === workId)
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
  
  // 회차 정렬 순서에 따라 장의 회차 순서를 확인하여 장 정렬
  const workChapters = episodeSortOrder === 'asc'
    ? [...workChaptersBase]
    : [...workChaptersBase].reverse()
  // 기본 정렬 후 정렬 순서에 따라 workEpisodes 정렬
  const workEpisodesBase = episodes
    .filter((e) => e.workId === workId)
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0) || a.episodeNumber - b.episodeNumber)
  
  const workEpisodes = episodeSortOrder === 'asc'
    ? [...workEpisodesBase].sort((a, b) => a.episodeNumber - b.episodeNumber)
    : [...workEpisodesBase].sort((a, b) => b.episodeNumber - a.episodeNumber)

  const { updateCharacter } = useCharacterStore()
  const { updateSetting } = useSettingStore()
  const [activeCharacterId, setActiveCharacterId] = useState<string | null>(null)
  const [activeSettingId, setActiveSettingId] = useState<string | null>(null)

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  )

  const handleCharacterDragStart = (event: any) => {
    setActiveCharacterId(event.active.id as string)
  }

  const handleCharacterDragCancel = () => {
    setActiveCharacterId(null)
  }

  const handleCharacterDragEnd = async (event: DragEndEvent) => {
    setActiveCharacterId(null)
    const { active, over } = event

    if (!over || active.id === over.id) {
      return
    }

    const mainCharacters = workCharacters.filter((c) => c.isMainCharacter)
    const supportingCharacters = workCharacters.filter((c) => !c.isMainCharacter)

    // 주연 캐릭터 내에서 드래그
    const mainIndex = mainCharacters.findIndex((c) => c.id === active.id)
    const mainOverIndex = mainCharacters.findIndex((c) => c.id === over.id)
    if (mainIndex !== -1 && mainOverIndex !== -1) {
      const reordered = arrayMove(mainCharacters, mainIndex, mainOverIndex)
      // 주연은 0부터 시작
      for (let i = 0; i < reordered.length; i++) {
        await updateCharacter(reordered[i].id, { order: i })
      }
      await loadCharacters() // 데이터 다시 로드
      return
    }

    // 조연 캐릭터 내에서 드래그
    const supportingIndex = supportingCharacters.findIndex((c) => c.id === active.id)
    const supportingOverIndex = supportingCharacters.findIndex((c) => c.id === over.id)
    if (supportingIndex !== -1 && supportingOverIndex !== -1) {
      const reordered = arrayMove(supportingCharacters, supportingIndex, supportingOverIndex)
      // 조연은 1000부터 시작 (주연과 겹치지 않도록)
      for (let i = 0; i < reordered.length; i++) {
        await updateCharacter(reordered[i].id, { order: 1000 + i })
      }
      await loadCharacters() // 데이터 다시 로드
      return
    }
  }

  const handleSettingDragStart = (event: any) => {
    setActiveSettingId(event.active.id as string)
  }

  const handleSettingDragCancel = () => {
    setActiveSettingId(null)
  }

  const handleSettingDragEnd = async (event: DragEndEvent) => {
    setActiveSettingId(null)
    const { active, over } = event

    if (!over || active.id === over.id) {
      return
    }

    const oldIndex = workSettings.findIndex((s) => s.id === active.id)
    const newIndex = workSettings.findIndex((s) => s.id === over.id)

    if (oldIndex !== -1 && newIndex !== -1) {
      const reordered = arrayMove(workSettings, oldIndex, newIndex)
      for (let i = 0; i < reordered.length; i++) {
        await updateSetting(reordered[i].id, { order: i })
      }
      await loadSettings() // 데이터 다시 로드
    }
  }

  const handleDelete = async () => {
    if (!workId || !confirm('정말 이 작품을 삭제하시겠습니까? 모든 시놉시스, 캐릭터, 설정도 함께 삭제됩니다.')) {
      return
    }
    try {
      await deleteWork(workId)
      navigate('/works')
    } catch (error) {
      console.error('삭제 실패:', error)
      alert('삭제에 실패했습니다.')
    }
  }

  if (isLoading || !currentWork) {
    return (
      <div className="p-8 flex justify-center items-center bg-white dark:bg-gray-900">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600 dark:text-blue-400" />
      </div>
    )
  }

  return (
    <div className="p-6 sm:p-6 md:p-8 bg-white dark:bg-gray-900">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-6 md:mb-8">
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
            <div className="flex-1 min-w-0">
              <h1 className="text-xl sm:text-2xl font-semibold text-gray-900 dark:text-gray-100 mb-1 break-words">{currentWork.title}</h1>
              {currentWork.description && (
                <p className="text-sm text-gray-600 dark:text-gray-400 break-words">{currentWork.description}</p>
              )}
            </div>
            <div className="flex gap-1.5 flex-shrink-0">
              <button
                onClick={() => setIsExportDialogOpen(true)}
                className="flex items-center gap-1 sm:gap-1.5 px-2 sm:px-3 py-1.5 text-xs sm:text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 transition-colors"
              >
                <Download className="w-4 h-4" />
                <span className="hidden sm:inline">내보내기</span>
              </button>
              <button
                onClick={() => navigate(`/works/${workId}/edit`)}
                className="flex items-center gap-1 sm:gap-1.5 px-2 sm:px-3 py-1.5 text-xs sm:text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 transition-colors"
              >
                <Edit2 className="w-4 h-4" />
                <span className="hidden sm:inline">편집</span>
              </button>
              <button
                onClick={handleDelete}
                className="flex items-center gap-1 sm:gap-1.5 px-2 sm:px-3 py-1.5 text-xs sm:text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 transition-colors"
              >
                <Trash2 className="w-4 h-4" />
                <span className="hidden sm:inline">삭제</span>
              </button>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="border-b border-gray-100 dark:border-gray-700 mb-6 overflow-x-auto">
          <nav className="flex gap-4 sm:gap-6 min-w-max sm:min-w-0">
            {[
              { id: 'synopsis' as TabType, label: '시놉시스', icon: BookOpen, count: 0 },
              { id: 'characters' as TabType, label: '캐릭터', icon: Users, count: workCharacters.length },
              { id: 'settings' as TabType, label: '설정', icon: Settings, count: workSettings.length },
              { id: 'episodes' as TabType, label: '연재', icon: FileText, count: workEpisodes.length },
            ].map((tab) => {
              const Icon = tab.icon
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-1.5 px-0 py-3 text-sm border-b-2 transition-colors ${
                    activeTab === tab.id
                      ? 'border-gray-900 dark:border-gray-100 text-gray-900 dark:text-gray-100 font-medium'
                      : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  <span>{tab.label}</span>
                  {tab.count > 0 && (
                    <span className="text-xs text-gray-400 dark:text-gray-500 ml-0.5">({tab.count})</span>
                  )}
                </button>
              )
            })}
          </nav>
        </div>

        {/* Content */}
        <div>
          {activeTab === 'synopsis' && (
            <div>
              {workSynopses.length > 0 && (
                <div>
                  <div className="flex justify-end mb-4">
                    <Link
                      to={`/works/${workId}/synopsis/${workSynopses[0].id}`}
                      className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-gray-900 dark:bg-gray-700 text-white hover:bg-gray-800 dark:hover:bg-gray-600 transition-colors"
                    >
                      <Edit2 className="w-4 h-4" />
                      시놉시스 편집
                    </Link>
                  </div>
                  {/* 시놉시스 미리보기 */}
                  <div className="space-y-6">
                    {workSynopses[0].structure ? (
                      <>
                        {/* 기 */}
                        <div className="mb-6 p-3 sm:p-4 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg">
                          <h3 className="text-base font-medium text-gray-900 dark:text-gray-100 mb-3 sm:mb-4">기</h3>
                          {workSynopses[0].structure.gi.length === 0 ? (
                            <p className="text-sm text-gray-400 dark:text-gray-500 text-center py-4">항목이 없습니다.</p>
                          ) : (
                            <div className="space-y-2 sm:space-y-3">
                              {workSynopses[0].structure.gi.map((s) => (
                                <div key={s.id} className="p-2 sm:p-3 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded">
                                  {s.title && <h4 className="font-medium text-gray-900 dark:text-gray-100 mb-2">{s.title}</h4>}
                                  {s.content && (
                                    <div className="prose prose-sm max-w-none" dangerouslySetInnerHTML={{ __html: s.content }} />
                                  )}
                                </div>
                              ))}
                            </div>
                          )}
                        </div>

                        {/* 승 */}
                        <div className="mb-6 p-3 sm:p-4 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg">
                          <h3 className="text-base font-medium text-gray-900 dark:text-gray-100 mb-3 sm:mb-4">승</h3>
                          {workSynopses[0].structure.seung.length === 0 ? (
                            <p className="text-sm text-gray-400 dark:text-gray-500 text-center py-4">항목이 없습니다.</p>
                          ) : (
                            <div className="space-y-2 sm:space-y-3">
                              {workSynopses[0].structure.seung.map((s) => (
                                <div key={s.id} className="p-2 sm:p-3 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded">
                                  {s.title && <h4 className="font-medium text-gray-900 dark:text-gray-100 mb-2">{s.title}</h4>}
                                  {s.content && (
                                    <div className="prose prose-sm max-w-none" dangerouslySetInnerHTML={{ __html: s.content }} />
                                  )}
                                </div>
                              ))}
                            </div>
                          )}
                        </div>

                        {/* 전 */}
                        <div className="mb-6 p-3 sm:p-4 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg">
                          <h3 className="text-base font-medium text-gray-900 dark:text-gray-100 mb-3 sm:mb-4">전</h3>
                          {workSynopses[0].structure.jeon.length === 0 ? (
                            <p className="text-sm text-gray-400 text-center py-4">항목이 없습니다.</p>
                          ) : (
                            <div className="space-y-2 sm:space-y-3">
                              {workSynopses[0].structure.jeon.map((s) => (
                                <div key={s.id} className="p-2 sm:p-3 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded">
                                  {s.title && <h4 className="font-medium text-gray-900 dark:text-gray-100 mb-2">{s.title}</h4>}
                                  {s.content && (
                                    <div className="prose prose-sm max-w-none" dangerouslySetInnerHTML={{ __html: s.content }} />
                                  )}
                                </div>
                              ))}
                            </div>
                          )}
                        </div>

                        {/* 결 */}
                        <div className="mb-6 p-3 sm:p-4 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg">
                          <h3 className="text-base font-medium text-gray-900 dark:text-gray-100 mb-3 sm:mb-4">결</h3>
                          {workSynopses[0].structure.gyeol.length === 0 ? (
                            <p className="text-sm text-gray-400 text-center py-4">항목이 없습니다.</p>
                          ) : (
                            <div className="space-y-2 sm:space-y-3">
                              {workSynopses[0].structure.gyeol.map((s) => (
                                <div key={s.id} className="p-2 sm:p-3 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded">
                                  {s.title && <h4 className="font-medium text-gray-900 dark:text-gray-100 mb-2">{s.title}</h4>}
                                  {s.content && (
                                    <div className="prose prose-sm max-w-none" dangerouslySetInnerHTML={{ __html: s.content }} />
                                  )}
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </>
                    ) : (
                      <div className="p-6 bg-gray-50 border border-gray-200 rounded-lg">
                        <p className="text-sm text-gray-400 text-center">시놉시스 구조가 없습니다.</p>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {activeTab === 'characters' && (
            <div>
              <div className="flex justify-end mb-4">
                <Link
                  to={`/works/${workId}/characters/new`}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-gray-900 text-white hover:bg-gray-800 transition-colors"
                >
                  <Plus className="w-4 h-4" />
                  새 캐릭터
                </Link>
              </div>
              {workCharacters.length === 0 ? (
                <div className="text-center py-12 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
                  <p className="text-sm text-gray-500 mb-4">캐릭터가 없습니다.</p>
                  <Link
                    to={`/works/${workId}/characters/new`}
                    className="px-3 py-1.5 text-sm bg-gray-900 text-white hover:bg-gray-800 transition-colors inline-block rounded"
                  >
                    첫 캐릭터 만들기
                  </Link>
                </div>
              ) : (
                <DndContext
                  sensors={sensors}
                  collisionDetection={closestCenter}
                  onDragStart={handleCharacterDragStart}
                  onDragCancel={handleCharacterDragCancel}
                  onDragEnd={handleCharacterDragEnd}
                >
                  <div className="space-y-8">
                    {/* 주연 캐릭터 */}
                    {workCharacters.some((c) => c.isMainCharacter) && (
                      <div>
                        <h3 className="text-base font-medium text-gray-900 mb-4">주연</h3>
                        <SortableContext
                          items={workCharacters.filter((c) => c.isMainCharacter).map((c) => c.id)}
                          strategy={verticalListSortingStrategy}
                        >
                          <div className="space-y-4">
                            {workCharacters
                              .filter((c) => c.isMainCharacter)
                              .map((character) => (
                                <CharacterCard
                                  key={character.id}
                                  character={character}
                                  workId={workId}
                                  isDraggable={true}
                                  activeId={activeCharacterId}
                                />
                              ))}
                          </div>
                        </SortableContext>
                      </div>
                    )}

                    {/* 조연 캐릭터 */}
                    {workCharacters.some((c) => !c.isMainCharacter) && (
                      <div>
                        <h3 className="text-base font-medium text-gray-900 mb-4">조연</h3>
                        <SortableContext
                          items={workCharacters.filter((c) => !c.isMainCharacter).map((c) => c.id)}
                          strategy={verticalListSortingStrategy}
                        >
                          <div className="space-y-4">
                            {workCharacters
                              .filter((c) => !c.isMainCharacter)
                              .map((character) => (
                                <CharacterCard
                                  key={character.id}
                                  character={character}
                                  workId={workId}
                                  isDraggable={true}
                                  activeId={activeCharacterId}
                                />
                              ))}
                          </div>
                        </SortableContext>
                      </div>
                    )}
                  </div>
                </DndContext>
              )}
            </div>
          )}

          {activeTab === 'settings' && (
            <div>
              <div className="flex justify-end mb-4">
                <Link
                  to={`/works/${workId}/settings/new`}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-gray-900 text-white hover:bg-gray-800 transition-colors"
                >
                  <Plus className="w-4 h-4" />
                  새 설정
                </Link>
              </div>
              {workSettings.length === 0 ? (
                <div className="text-center py-12 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
                  <p className="text-sm text-gray-500 mb-4">설정이 없습니다.</p>
                  <Link
                    to={`/works/${workId}/settings/new`}
                    className="px-3 py-1.5 text-sm bg-gray-900 text-white hover:bg-gray-800 transition-colors inline-block rounded"
                  >
                    첫 설정 만들기
                  </Link>
                </div>
              ) : (
                <DndContext
                  sensors={sensors}
                  collisionDetection={closestCenter}
                  onDragStart={handleSettingDragStart}
                  onDragCancel={handleSettingDragCancel}
                  onDragEnd={handleSettingDragEnd}
                >
                  <SortableContext items={workSettings.map((s) => s.id)} strategy={verticalListSortingStrategy}>
                    <div className="space-y-4">
                      {workSettings.map((setting) => (
                        <SettingCard
                          key={setting.id}
                          setting={setting}
                          workId={workId}
                          isDraggable={true}
                          activeId={activeSettingId}
                        />
                      ))}
                    </div>
                  </SortableContext>
                </DndContext>
              )}
            </div>
          )}

          {activeTab === 'episodes' && (
            <div>
              {/* 서브 탭 */}
              <div className="border-b border-gray-100 dark:border-gray-700 mb-6">
                <nav className="flex gap-6">
                  {[
                    { id: 'list' as const, label: '회차', icon: FileText },
                    { id: 'episodeStats' as const, label: '회차 통계', icon: BarChart3 },
                    { id: 'serialStats' as const, label: '연재 통계', icon: BarChart3 },
                  ].map((tab) => {
                    const Icon = tab.icon
                    return (
                      <button
                        key={tab.id}
                        onClick={() => setEpisodeSubTab(tab.id)}
                        className={`flex items-center gap-1.5 px-0 py-3 text-sm border-b-2 transition-colors ${
                          episodeSubTab === tab.id
                            ? 'border-gray-900 dark:border-gray-100 text-gray-900 dark:text-gray-100 font-medium'
                            : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100'
                        }`}
                      >
                        <Icon className="w-4 h-4" />
                        <span>{tab.label}</span>
                      </button>
                    )
                  })}
                </nav>
              </div>

              {episodeSubTab === 'list' && (
                <div>
                  <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3 mb-4">
                    <div className="flex items-center gap-2">
                      <label className="text-sm text-gray-600 dark:text-gray-400">정렬:</label>
                      <select
                        value={episodeSortOrder}
                        onChange={(e) => setEpisodeSortOrder(e.target.value as 'asc' | 'desc')}
                        className="px-3 py-1 text-sm border border-gray-200 dark:border-gray-700 rounded focus:outline-none focus:border-gray-400 dark:focus:border-gray-500 transition-colors bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                      >
                        <option value="asc">1화부터</option>
                        <option value="desc">최신화부터</option>
                      </select>
                    </div>
                    <div className="flex gap-2 items-center flex-wrap">
                      <Link
                        to={`/works/${workId}/chapters`}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-sm border border-gray-200 dark:border-gray-700 rounded hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors text-gray-700 dark:text-gray-300"
                      >
                        장 관리
                      </Link>
                      <Link
                        to={`/works/${workId}/episodes/new`}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-gray-900 dark:bg-gray-700 text-white hover:bg-gray-800 dark:hover:bg-gray-600 transition-colors"
                      >
                        <Plus className="w-4 h-4" />
                        새 회차
                      </Link>
                    </div>
                  </div>
                  {workEpisodes.length === 0 ? (
                    <div className="text-center py-12 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
                      <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">회차가 없습니다.</p>
                      <Link
                        to={`/works/${workId}/episodes/new`}
                        className="px-3 py-1.5 text-sm bg-gray-900 dark:bg-gray-700 text-white hover:bg-gray-800 dark:hover:bg-gray-600 transition-colors inline-block rounded"
                      >
                        첫 회차 만들기
                      </Link>
                    </div>
                  ) : (
                    <div className="space-y-6">
                      {workChapters.map((chapter) => {
                        const chapterEpisodes = workEpisodes.filter((e) => e.chapterId === chapter.id)
                        return (
                          <div key={chapter.id} className="bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-3 sm:p-4">
                            <div className="flex items-center justify-between mb-4">
                              <h3 className="text-base font-medium text-gray-900 dark:text-gray-100">
                                {chapter.title}
                                {chapter.structureType && (
                                  <span className="ml-2 text-xs px-2 py-0.5 rounded bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300">
                                    {chapter.structureType === 'gi' ? '기' :
                                     chapter.structureType === 'seung' ? '승' :
                                     chapter.structureType === 'jeon' ? '전' :
                                     chapter.structureType === 'gyeol' ? '결' : ''}
                                  </span>
                                )}
                              </h3>
                              <Link
                                to={`/works/${workId}/chapters/${chapter.id}`}
                                className="text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100"
                              >
                                편집
                              </Link>
                            </div>
                            {chapterEpisodes.length === 0 ? (
                              <p className="text-sm text-gray-400 dark:text-gray-500 text-center py-4">회차가 없습니다.</p>
                            ) : (
                              <div className="space-y-3">
                                {chapterEpisodes.map((episode) => (
                                  <Link
                                    key={episode.id}
                                    to={`/works/${workId}/episodes/${episode.id}`}
                                    className="block bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600 hover:shadow-sm transition-all p-3 sm:p-5"
                                  >
                                    <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2 sm:gap-3">
                                      <div className="flex-1 min-w-0">
                                        <h4 className="text-base sm:text-lg font-semibold text-gray-900 dark:text-gray-100 mb-1.5 sm:mb-2 break-words">
                                          제 {episode.episodeNumber}화{episode.title ? ` ${episode.title}` : ''}
                                        </h4>
                                        {(() => {
                                          // 공백 포함/미포함 계산
                                          const tempDiv = document.createElement('div')
                                          tempDiv.innerHTML = episode.content || ''
                                          const text = tempDiv.textContent || tempDiv.innerText || ''
                                          const withSpaces = text.length
                                          const withoutSpaces = text.replace(/\s/g, '').length
                                          return (
                                            <div className="text-sm text-gray-500 dark:text-gray-400 space-y-1">
                                              <p>공포: {withSpaces.toLocaleString()}자</p>
                                              <p>공미포: {withoutSpaces.toLocaleString()}자</p>
                                            </div>
                                          )
                                        })()}
                                        {episode.publishedAt && (
                                          <p className="text-sm text-gray-500 dark:text-gray-400">
                                            발행일: {new Date(episode.publishedAt).toLocaleDateString('ko-KR')}
                                          </p>
                                        )}
                                      </div>
                                      <div className="text-left sm:text-right sm:ml-4 flex-shrink-0">
                                        {episode.subscriberCount !== undefined && (
                                          <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">
                                            선작수: {episode.subscriberCount.toLocaleString()}
                                          </p>
                                        )}
                                        {episode.viewCount !== undefined && (
                                          <p className="text-sm text-gray-500 dark:text-gray-400">
                                            조회수: {episode.viewCount.toLocaleString()}
                                          </p>
                                        )}
                                      </div>
                                    </div>
                                  </Link>
                                ))}
                              </div>
                            )}
                          </div>
                        )
                      })}

                      {workEpisodes.filter((e) => !e.chapterId).length > 0 && (
                        <div className="bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-3 sm:p-4">
                          {workChapters.length > 0 && (
                            <h3 className="text-base font-medium text-gray-900 dark:text-gray-100 mb-4">기타</h3>
                          )}
                          <div className="space-y-3">
                            {workEpisodes
                              .filter((e) => !e.chapterId)
                              .map((episode) => (
                                <Link
                                  key={episode.id}
                                  to={`/works/${workId}/episodes/${episode.id}`}
                                  className="block bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600 hover:shadow-sm transition-all p-3 sm:p-5"
                                >
                                  <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2 sm:gap-3">
                                    <div className="flex-1 min-w-0">
                                      <h4 className="text-base sm:text-lg font-semibold text-gray-900 dark:text-gray-100 mb-1.5 sm:mb-2 break-words">
                                        제 {episode.episodeNumber}화{episode.title ? ` ${episode.title}` : ''}
                                      </h4>
                                      {(() => {
                                        const tempDiv = document.createElement('div')
                                        tempDiv.innerHTML = episode.content || ''
                                        const text = tempDiv.textContent || tempDiv.innerText || ''
                                        const withSpaces = text.length
                                        const withoutSpaces = text.replace(/\s/g, '').length
                                        return (
                                          <div className="text-sm text-gray-500 dark:text-gray-400 space-y-1">
                                            <p>공포: {withSpaces.toLocaleString()}자</p>
                                            <p>공미포: {withoutSpaces.toLocaleString()}자</p>
                                          </div>
                                        )
                                      })()}
                                      {episode.publishedAt && (
                                        <p className="text-sm text-gray-500 dark:text-gray-400">
                                          발행일: {new Date(episode.publishedAt).toLocaleDateString('ko-KR')}
                                        </p>
                                      )}
                                    </div>
                                    <div className="text-left sm:text-right sm:ml-4 flex-shrink-0">
                                      {episode.subscriberCount !== undefined && (
                                        <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">
                                          선작수: {episode.subscriberCount.toLocaleString()}
                                        </p>
                                      )}
                                      {episode.viewCount !== undefined && (
                                        <p className="text-sm text-gray-500 dark:text-gray-400">
                                          조회수: {episode.viewCount.toLocaleString()}
                                        </p>
                                      )}
                                    </div>
                                  </div>
                                </Link>
                              ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {episodeSubTab === 'episodeStats' && (
                <div className="space-y-6">
                  {/* 전체 통계 */}
                  <div>
                    <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">전체 통계</h2>
                    <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
                      <div className="mb-6">
                        <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">총 회차 수</p>
                        <p className="text-lg font-bold text-gray-900 dark:text-gray-100">{workEpisodes.length}화</p>
                      </div>
                      
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {/* 공포 섹션 */}
                        <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 bg-gray-50 dark:bg-gray-800">
                          <h3 className="text-sm font-medium text-gray-900 dark:text-gray-100 mb-4">공포 (공백 포함)</h3>
                          <div className="space-y-4">
                            <div>
                              <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">총 글자 수</p>
                              <p className="text-lg font-bold text-gray-900 dark:text-gray-100">
                                {workEpisodes.reduce((sum, e) => {
                                  if (!e.content) return sum
                                  const tempDiv = document.createElement('div')
                                  tempDiv.innerHTML = e.content
                                  const text = tempDiv.textContent || tempDiv.innerText || ''
                                  return sum + text.length
                                }, 0).toLocaleString()}자
                              </p>
                            </div>
                            <div>
                              <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">평균 글자 수</p>
                              <p className="text-lg font-bold text-gray-900 dark:text-gray-100">
                                {workEpisodes.length > 0
                                  ? Math.round(
                                      workEpisodes.reduce((sum, e) => {
                                        if (!e.content) return sum
                                        const tempDiv = document.createElement('div')
                                        tempDiv.innerHTML = e.content
                                        const text = tempDiv.textContent || tempDiv.innerText || ''
                                        return sum + text.length
                                      }, 0) / workEpisodes.length
                                    ).toLocaleString()
                                  : 0}
                                자
                              </p>
                            </div>
                          </div>
                        </div>

                        {/* 공미포 섹션 */}
                        <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 bg-gray-50 dark:bg-gray-800">
                          <h3 className="text-sm font-medium text-gray-900 dark:text-gray-100 mb-4">공미포 (공백 미포함)</h3>
                          <div className="space-y-4">
                            <div>
                              <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">총 글자 수</p>
                              <p className="text-lg font-bold text-gray-900 dark:text-gray-100">
                                {workEpisodes.reduce((sum, e) => {
                                  if (!e.content) return sum
                                  const tempDiv = document.createElement('div')
                                  tempDiv.innerHTML = e.content
                                  const text = tempDiv.textContent || tempDiv.innerText || ''
                                  return sum + text.replace(/\s/g, '').length
                                }, 0).toLocaleString()}자
                              </p>
                            </div>
                            <div>
                              <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">평균 글자 수</p>
                              <p className="text-lg font-bold text-gray-900 dark:text-gray-100">
                                {workEpisodes.length > 0
                                  ? Math.round(
                                      workEpisodes.reduce((sum, e) => {
                                        if (!e.content) return sum
                                        const tempDiv = document.createElement('div')
                                        tempDiv.innerHTML = e.content
                                        const text = tempDiv.textContent || tempDiv.innerText || ''
                                        return sum + text.replace(/\s/g, '').length
                                      }, 0) / workEpisodes.length
                                    ).toLocaleString()
                                  : 0}
                                자
                              </p>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* 장별 통계 */}
                  {workChapters.length > 0 && (
                    <div>
                      <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">장별 통계</h2>
                      <div className="space-y-4">
                        {workChapters.map((chapter) => {
                          const chapterEpisodes = workEpisodes.filter((e) => e.chapterId === chapter.id)
                          
                          const calculateWords = (episodes: typeof chapterEpisodes, withSpaces: boolean) => {
                            return episodes.reduce((sum, e) => {
                              if (!e.content) return sum
                              const tempDiv = document.createElement('div')
                              tempDiv.innerHTML = e.content
                              const text = tempDiv.textContent || tempDiv.innerText || ''
                              return sum + (withSpaces ? text.length : text.replace(/\s/g, '').length)
                            }, 0)
                          }

                          const totalWordsWithSpaces = calculateWords(chapterEpisodes, true)
                          const totalWordsWithoutSpaces = calculateWords(chapterEpisodes, false)
                          const avgWordsWithSpaces = chapterEpisodes.length > 0 ? Math.round(totalWordsWithSpaces / chapterEpisodes.length) : 0
                          const avgWordsWithoutSpaces = chapterEpisodes.length > 0 ? Math.round(totalWordsWithoutSpaces / chapterEpisodes.length) : 0

                          return (
                            <div key={chapter.id} className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
                              <h3 className="text-base font-medium text-gray-900 dark:text-gray-100 mb-4">
                                {chapter.title}
                                {chapter.structureType && (
                                  <span className="ml-2 text-xs px-2 py-0.5 rounded bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300">
                                    {chapter.structureType === 'gi' && '기'}
                                    {chapter.structureType === 'seung' && '승'}
                                    {chapter.structureType === 'jeon' && '전'}
                                    {chapter.structureType === 'gyeol' && '결'}
                                  </span>
                                )}
                              </h3>
                              <div className="mb-4">
                                <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">회차 수</p>
                                <p className="text-base font-bold text-gray-900 dark:text-gray-100">{chapterEpisodes.length}화</p>
                              </div>
                              
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                {/* 공포 섹션 */}
                                <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 bg-gray-50 dark:bg-gray-800">
                                  <h4 className="text-sm font-medium text-gray-900 dark:text-gray-100 mb-3">공포 (공백 포함)</h4>
                                  <div className="space-y-3">
                                    <div>
                                      <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">총 글자 수</p>
                                      <p className="text-base font-bold text-gray-900 dark:text-gray-100">{totalWordsWithSpaces.toLocaleString()}자</p>
                                    </div>
                                    <div>
                                      <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">평균 글자 수</p>
                                      <p className="text-base font-bold text-gray-900 dark:text-gray-100">{avgWordsWithSpaces.toLocaleString()}자</p>
                                    </div>
                                  </div>
                                </div>

                                {/* 공미포 섹션 */}
                                <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 bg-gray-50 dark:bg-gray-800">
                                  <h4 className="text-sm font-medium text-gray-900 dark:text-gray-100 mb-3">공미포 (공백 미포함)</h4>
                                  <div className="space-y-3">
                                    <div>
                                      <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">총 글자 수</p>
                                      <p className="text-base font-bold text-gray-900 dark:text-gray-100">{totalWordsWithoutSpaces.toLocaleString()}자</p>
                                    </div>
                                    <div>
                                      <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">평균 글자 수</p>
                                      <p className="text-base font-bold text-gray-900 dark:text-gray-100">{avgWordsWithoutSpaces.toLocaleString()}자</p>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  )}

                  {/* 기승전결별 통계 */}
                  {(() => {
                    const structureTypes = ['gi', 'seung', 'jeon', 'gyeol'] as const
                    const structureLabels = { gi: '기', seung: '승', jeon: '전', gyeol: '결' }
                    const structureGroups = structureTypes.map((type) => ({
                      type,
                      label: structureLabels[type],
                      chapters: workChapters.filter((c) => c.structureType === type),
                    })).filter((group) => group.chapters.length > 0)

                    if (structureGroups.length === 0) return null

                    return (
                      <div>
                        <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">기승전결별 통계</h2>
                        <div className="space-y-4">
                          {structureGroups.map(({ type, label, chapters }) => {
                            const allEpisodes = chapters.flatMap((chapter) =>
                              workEpisodes.filter((e) => e.chapterId === chapter.id)
                            )
                            const publishedEpisodes = allEpisodes.filter((e) => e.publishedAt)
                            const unpublishedEpisodes = allEpisodes.filter((e) => !e.publishedAt)
                            
                            const calculateWords = (episodes: typeof allEpisodes, withSpaces: boolean) => {
                              return episodes.reduce((sum, e) => {
                                if (!e.content) return sum
                                const tempDiv = document.createElement('div')
                                tempDiv.innerHTML = e.content
                                const text = tempDiv.textContent || tempDiv.innerText || ''
                                return sum + (withSpaces ? text.length : text.replace(/\s/g, '').length)
                              }, 0)
                            }

                            const totalWordsWithSpaces = calculateWords(allEpisodes, true)
                            const totalWordsWithoutSpaces = calculateWords(allEpisodes, false)
                            const avgWordsWithSpaces = allEpisodes.length > 0 ? Math.round(totalWordsWithSpaces / allEpisodes.length) : 0
                            const avgWordsWithoutSpaces = allEpisodes.length > 0 ? Math.round(totalWordsWithoutSpaces / allEpisodes.length) : 0

                            return (
                              <div key={type} className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
                                <h3 className="text-base font-medium text-gray-900 dark:text-gray-100 mb-4">{label}</h3>
                                <div className="mb-4">
                                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div>
                                      <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">장 수</p>
                                      <p className="text-base font-bold text-gray-900 dark:text-gray-100">{chapters.length}개</p>
                                    </div>
                                    <div>
                                      <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">회차 수</p>
                                      <p className="text-base font-bold text-gray-900 dark:text-gray-100">{allEpisodes.length}화</p>
                                    </div>
                                  </div>
                                </div>
                                
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                  {/* 공포 섹션 */}
                                  <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 bg-gray-50 dark:bg-gray-800">
                                    <h4 className="text-sm font-medium text-gray-900 dark:text-gray-100 mb-3">공포 (공백 포함)</h4>
                                    <div className="space-y-3">
                                      <div>
                                        <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">총 글자 수</p>
                                        <p className="text-base font-bold text-gray-900 dark:text-gray-100">{totalWordsWithSpaces.toLocaleString()}자</p>
                                      </div>
                                      <div>
                                        <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">평균 글자 수</p>
                                        <p className="text-base font-bold text-gray-900 dark:text-gray-100">{avgWordsWithSpaces.toLocaleString()}자</p>
                                      </div>
                                    </div>
                                  </div>

                                  {/* 공미포 섹션 */}
                                  <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 bg-gray-50 dark:bg-gray-800">
                                    <h4 className="text-sm font-medium text-gray-900 dark:text-gray-100 mb-3">공미포 (공백 미포함)</h4>
                                    <div className="space-y-3">
                                      <div>
                                        <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">총 글자 수</p>
                                        <p className="text-base font-bold text-gray-900 dark:text-gray-100">{totalWordsWithoutSpaces.toLocaleString()}자</p>
                                      </div>
                                      <div>
                                        <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">평균 글자 수</p>
                                        <p className="text-base font-bold text-gray-900 dark:text-gray-100">{avgWordsWithoutSpaces.toLocaleString()}자</p>
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            )
                          })}
                        </div>
                      </div>
                    )
                  })()}
                </div>
              )}

              {episodeSubTab === 'serialStats' && (
                <div className="space-y-6">
                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-4 gap-2">
                    <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">연재 통계</h2>
                    <div className="flex items-center gap-2">
                      <label className="text-sm text-gray-600 dark:text-gray-400">회차 표시 간격:</label>
                      <select
                        value={episodeDisplayInterval}
                        onChange={(e) => setEpisodeDisplayInterval(Number(e.target.value))}
                        className="px-3 py-1 text-sm border border-gray-200 dark:border-gray-700 rounded focus:outline-none focus:border-gray-400 dark:focus:border-gray-500 transition-colors bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                      >
                        <option value={1}>모든 회차</option>
                        <option value={5}>5개 단위</option>
                        <option value={10}>10개 단위</option>
                        <option value={20}>20개 단위</option>
                        <option value={50}>50개 단위</option>
                      </select>
                    </div>
                  </div>
                  
                  {/* 선작수 그래프 */}
                  {(() => {
                    const episodesWithSubscriber = workEpisodes.filter((e) => e.subscriberCount !== undefined && e.subscriberCount !== null)
                    if (episodesWithSubscriber.length === 0) return null
                    
                    const sortedEpisodes = [...episodesWithSubscriber].sort((a, b) => a.episodeNumber - b.episodeNumber)
                    const maxSubscriber = Math.max(...sortedEpisodes.map((e) => e.subscriberCount || 0))
                    const minSubscriber = Math.min(...sortedEpisodes.map((e) => e.subscriberCount || 0))
                    const range = maxSubscriber - minSubscriber || 1
                    const graphHeight = 300
                    const graphWidth = 600
                    const padding = 40
                    const pointRadius = 4
                    
                    // 좌표 계산
                    const points = sortedEpisodes.map((episode, index) => {
                      const x = padding + (index / (sortedEpisodes.length - 1 || 1)) * (graphWidth - padding * 2)
                      const y = padding + graphHeight - ((episode.subscriberCount! - minSubscriber) / range) * (graphHeight - padding * 2)
                      return { x, y, episode }
                    })
                    
                    // 선 경로 생성
                    const pathData = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ')
                    
                    return (
                      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-3 sm:p-6">
                        <h3 className="text-base font-medium text-gray-900 dark:text-gray-100 mb-4">선작수 추이</h3>
                        <div className="overflow-x-auto -mx-3 sm:mx-0">
                          <svg 
                            viewBox={`0 0 ${graphWidth} ${graphHeight + padding * 2}`}
                            className="w-full h-auto min-w-full"
                            preserveAspectRatio="xMinYMin meet"
                          >
                            {/* 그리드 라인 */}
                            {[0, 0.25, 0.5, 0.75, 1].map((ratio) => {
                              const y = padding + graphHeight - ratio * (graphHeight - padding * 2)
                              const value = Math.round(minSubscriber + ratio * range)
                              return (
                                <g key={ratio}>
                                  <line
                                    x1={padding}
                                    y1={y}
                                    x2={graphWidth - padding}
                                    y2={y}
                                    stroke="#e5e7eb"
                                    strokeWidth="1"
                                    strokeDasharray="4 4"
                                    className="dark:stroke-gray-600"
                                  />
                                  <text
                                    x={padding - 10}
                                    y={y + 4}
                                    textAnchor="end"
                                    className="text-xs fill-gray-500 dark:fill-gray-400"
                                  >
                                    {value.toLocaleString()}
                                  </text>
                                </g>
                              )
                            })}
                            
                            {/* 데이터 선 */}
                            <path
                              d={pathData}
                              fill="none"
                              stroke="#3b82f6"
                              strokeWidth="2"
                              className="drop-shadow-sm"
                            />
                            
                            {/* 데이터 포인트 */}
                            {points.map((point, index) => (
                              <g key={point.episode.id}>
                                <circle
                                  cx={point.x}
                                  cy={point.y}
                                  r={pointRadius}
                                  fill="#3b82f6"
                                  className="hover:r-6 transition-all cursor-pointer"
                                />
                                <title>
                                  {`제 ${point.episode.episodeNumber}화: ${point.episode.subscriberCount?.toLocaleString()}`}
                                </title>
                                {/* X축 레이블 - 선택한 간격에 따라 표시 */}
                                {index % episodeDisplayInterval === 0 && (
                                  <text
                                    x={point.x}
                                    y={graphHeight + padding + 20}
                                    textAnchor="middle"
                                    className="text-xs fill-gray-500 dark:fill-gray-400"
                                  >
                                    {point.episode.episodeNumber}화
                                  </text>
                                )}
                              </g>
                            ))}
                          </svg>
                        </div>
                      </div>
                    )
                  })()}

                  {/* 조회수 그래프 */}
                  {(() => {
                    const episodesWithView = workEpisodes.filter((e) => e.viewCount !== undefined && e.viewCount !== null)
                    if (episodesWithView.length === 0) return null
                    
                    const sortedEpisodes = [...episodesWithView].sort((a, b) => a.episodeNumber - b.episodeNumber)
                    const maxView = Math.max(...sortedEpisodes.map((e) => e.viewCount || 0))
                    const minView = Math.min(...sortedEpisodes.map((e) => e.viewCount || 0))
                    const range = maxView - minView || 1
                    const graphHeight = 300
                    const graphWidth = 600
                    const padding = 40
                    const pointRadius = 4
                    
                    // 좌표 계산
                    const points = sortedEpisodes.map((episode, index) => {
                      const x = padding + (index / (sortedEpisodes.length - 1 || 1)) * (graphWidth - padding * 2)
                      const y = padding + graphHeight - ((episode.viewCount! - minView) / range) * (graphHeight - padding * 2)
                      return { x, y, episode }
                    })
                    
                    // 선 경로 생성
                    const pathData = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ')
                    
                    return (
                      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-3 sm:p-6">
                        <h3 className="text-base font-medium text-gray-900 dark:text-gray-100 mb-4">조회수 추이</h3>
                        <div className="overflow-x-auto -mx-3 sm:mx-0">
                          <svg 
                            viewBox={`0 0 ${graphWidth} ${graphHeight + padding * 2}`}
                            className="w-full h-auto min-w-full"
                            preserveAspectRatio="xMinYMin meet"
                          >
                            {/* 그리드 라인 */}
                            {[0, 0.25, 0.5, 0.75, 1].map((ratio) => {
                              const y = padding + graphHeight - ratio * (graphHeight - padding * 2)
                              const value = Math.round(minView + ratio * range)
                              return (
                                <g key={ratio}>
                                  <line
                                    x1={padding}
                                    y1={y}
                                    x2={graphWidth - padding}
                                    y2={y}
                                    stroke="#e5e7eb"
                                    strokeWidth="1"
                                    strokeDasharray="4 4"
                                    className="dark:stroke-gray-600"
                                  />
                                  <text
                                    x={padding - 10}
                                    y={y + 4}
                                    textAnchor="end"
                                    className="text-xs fill-gray-500 dark:fill-gray-400"
                                  >
                                    {value.toLocaleString()}
                                  </text>
                                </g>
                              )
                            })}
                            
                            {/* 데이터 선 */}
                            <path
                              d={pathData}
                              fill="none"
                              stroke="#10b981"
                              strokeWidth="2"
                              className="drop-shadow-sm"
                            />
                            
                            {/* 데이터 포인트 */}
                            {points.map((point, index) => (
                              <g key={point.episode.id}>
                                <circle
                                  cx={point.x}
                                  cy={point.y}
                                  r={pointRadius}
                                  fill="#10b981"
                                  className="hover:r-6 transition-all cursor-pointer"
                                />
                                <title>
                                  {`제 ${point.episode.episodeNumber}화: ${point.episode.viewCount?.toLocaleString()}`}
                                </title>
                                {/* X축 레이블 - 선택한 간격에 따라 표시 */}
                                {index % episodeDisplayInterval === 0 && (
                                  <text
                                    x={point.x}
                                    y={graphHeight + padding + 20}
                                    textAnchor="middle"
                                    className="text-xs fill-gray-500 dark:fill-gray-400"
                                  >
                                    {point.episode.episodeNumber}화
                                  </text>
                                )}
                              </g>
                            ))}
                          </svg>
                        </div>
                      </div>
                    )
                  })()}

                  {!workEpisodes.some((e) => (e.subscriberCount !== undefined && e.subscriberCount !== null) || (e.viewCount !== undefined && e.viewCount !== null)) && (
                    <div className="text-center py-12 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
                      <p className="text-gray-500 dark:text-gray-400">선작수/조회수 데이터가 없습니다.</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Export Dialog */}
      {currentWork && (
        <WorkExportDialog
          work={currentWork}
          synopsis={workSynopses[0] || null}
          characters={workCharacters}
          settings={workSettings}
          tags={tags}
          isOpen={isExportDialogOpen}
          onClose={() => setIsExportDialogOpen(false)}
        />
      )}
    </div>
  )
}

