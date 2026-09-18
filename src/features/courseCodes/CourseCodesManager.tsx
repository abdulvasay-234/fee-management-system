import { BookKey, Edit3, LockKeyhole, Search, Trash2 } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Badge, Button, Card, EmptyState, Input, Modal, Select, Table } from '../../components/ui'
import {
  deleteCourseCode,
  getCachedCourseCodes,
  getAvailableRegularCodeCount,
  getCourseCodes,
  isSystemCourseCode,
} from './courseCodeService'
import { CourseCodeFormModal } from './CourseCodeFormModal'
import type { CourseCode } from './courseCodeTypes'

type CourseFilter = 'all' | 'Regular' | 'Other'

const filterOptions = [
  { label: 'All', value: 'all' },
  { label: 'Regular Courses', value: 'Regular' },
  { label: 'Other Programs', value: 'Other' },
]

export function CourseCodesManager() {
  const [revision, setRevision] = useState(0)
  const [courses, setCourses] = useState(getCachedCourseCodes)
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState<CourseFilter>('all')
  const [editingCourse, setEditingCourse] = useState<CourseCode | null>(null)
  const [deletingCourse, setDeletingCourse] = useState<CourseCode | null>(null)
  const [deleteError, setDeleteError] = useState('')
  const [isDeleting, setIsDeleting] = useState(false)

  const regularCourses = courses.filter((course) => course.type === 'Regular')
  const reservedCourses = courses.filter((course) => course.type === 'Other')
  const normalizedQuery = query.trim().toLowerCase()
  const filteredCourses = courses.filter((course) =>
    (!normalizedQuery || course.code.includes(normalizedQuery) || course.name.toLowerCase().includes(normalizedQuery))
    && (filter === 'all' || course.type === filter),
  )

  useEffect(() => {
    let active = true
    void getCourseCodes().then((loadedCourses) => {
      if (active) setCourses(loadedCourses)
    })
    return () => { active = false }
  }, [])

  function refresh() {
    setCourses(getCachedCourseCodes())
    setRevision((value) => value + 1)
    setEditingCourse(null)
    setDeletingCourse(null)
  }

  async function confirmDelete() {
    if (!deletingCourse || isDeleting) return
    setDeleteError('')
    setIsDeleting(true)
    try {
      const deleted = await deleteCourseCode(deletingCourse.id)
      if (!deleted) throw new Error('This course code cannot be deleted.')
      refresh()
    } catch (error) {
      setDeleteError(error instanceof Error ? error.message : 'Unable to delete the course code.')
    } finally {
      setIsDeleting(false)
    }
  }

  return (
    <>
      <section className="course-code-summary" aria-label="Course code summary" data-revision={revision}>
        <Card><span>Total Courses</span><strong>{regularCourses.length}</strong></Card>
        <Card><span>Used Codes</span><strong>{regularCourses.length}</strong></Card>
        <Card><span>Available Codes</span><strong>{getAvailableRegularCodeCount()}</strong></Card>
        <Card className="course-code-summary__reserved"><span>Other Programs</span><strong>{reservedCourses.length}</strong></Card>
      </section>

      <Card className="course-code-tools">
        <Input id="courseCodeSearch" label="Search" placeholder="Search courses or codes..." value={query} onChange={(event) => setQuery(event.target.value)} />
        <Select id="courseCodeFilter" label="Type" options={filterOptions} value={filter} onChange={(event) => setFilter(event.target.value as CourseFilter)} />
      </Card>

      <section className="course-code-reserved-note">
        <LockKeyhole aria-hidden="true" size={20} />
        <div>
          <h2>Code 00 is reserved for Other Programs</h2>
          <p>Used for workshops, bootcamps, masterclasses, seminars, events, certifications, and other non-course payments. These use identifiers such as <strong>LSA-26-00-WORKSHOP-01</strong>, not YYCCBBSS.</p>
        </div>
      </section>

      {filteredCourses.length > 0 ? (
        <Table className="course-codes-table">
          <thead><tr><th>Code</th><th>Course Name</th><th>Type</th><th>Active</th><th>Actions</th></tr></thead>
          <tbody>
            {filteredCourses.map((course) => (
              <tr className={course.type === 'Other' ? 'course-codes-table__reserved' : ''} key={course.id}>
                <td><span className="course-code-value">{course.code}</span></td>
                <td><strong>{course.name}</strong>{course.type === 'Other' && <small>Reserved for Other Programs</small>}</td>
                <td><Badge variant={course.type === 'Other' ? 'yellow' : 'navy'}>{course.type}</Badge></td>
                <td>{course.active ? 'Yes' : 'No'}</td>
                <td>
                  <div className="course-codes-table__actions">
                    {course.type === 'Other' ? (
                      <Badge variant="yellow">Reserved</Badge>
                    ) : (
                      <>
                        <Button variant="secondary" onClick={() => setEditingCourse(course)}><Edit3 aria-hidden="true" size={14} />Edit</Button>
                        {!isSystemCourseCode(course) && <Button variant="secondary" onClick={() => setDeletingCourse(course)}><Trash2 aria-hidden="true" size={14} />Delete</Button>}
                      </>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </Table>
      ) : (
        <EmptyState icon={<Search size={22} />} title="No courses found" description="Try changing your search or filters." />
      )}

      {editingCourse && (
        <CourseCodeFormModal course={editingCourse} isInUse={false} onClose={() => setEditingCourse(null)} onSaved={refresh} />
      )}
      {deletingCourse && (
        <Modal
          open
          title="Delete course code?"
          description="Are you sure you want to delete this course code?"
          onClose={() => setDeletingCourse(null)}
          footer={<><Button variant="secondary" onClick={() => setDeletingCourse(null)}>Cancel</Button><Button disabled={isDeleting} onClick={confirmDelete}>{isDeleting ? 'Deleting...' : 'Delete Course'}</Button></>}
        >
          <div className="course-code-delete-preview"><BookKey aria-hidden="true" size={20} /><div><strong>{deletingCourse.code} - {deletingCourse.name}</strong><p>Protected system course codes cannot be deleted.</p></div></div>
          {deleteError && <p className="field__message field__message--error" role="alert">{deleteError}</p>}
        </Modal>
      )}

    </>
  )
}