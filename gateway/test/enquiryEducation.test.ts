import { fileURLToPath } from 'node:url'
import { afterEach, describe, expect, it, vi } from 'vitest'

vi.mock('../../src/features/courseCodes/CourseLabel.tsx', () => ({
  CourseLabel: ({ name }: { name: string }) => name,
  CourseDot: () => null,
}))

const { getSpecializationOptions } = await import(fileURLToPath(new URL('../../src/config/educationOptions.ts', import.meta.url)))
const { otherOption } = await import(fileURLToPath(new URL('../../src/config/enquiryOptions.ts', import.meta.url)))
const { encodeEnquiryPayload, getEnquiryEducationState, normalizeEnquiryRecord } = await import(
  fileURLToPath(new URL('../../src/features/enquiries/enquiryEducation.ts', import.meta.url)),
)

const payload = {
  fullName: 'Test Student',
  mobileNumber: '9000000000',
  email: '',
  college: 'Test College',
  educationLevel: 'B.Tech',
  specialization: 'CSE',
  yearOfGraduation: 'Currently Pursuing',
  courseInterestedIn: 'Data Science',
  otherProgramDetails: '',
  referral: 'Website',
  notes: 'First line\nSecond line',
  consultedBy: 'LSA Staff',
  enquiryDate: '2026-11-27',
}

function legacyRecord(saved: typeof payload & { degreeCourse: string }) {
  return {
    enquiryId: 'ENQ-000001',
    fullName: saved.fullName,
    mobileNumber: saved.mobileNumber,
    email: saved.email,
    college: saved.college,
    degreeCourse: saved.degreeCourse,
    yearOfGraduation: saved.yearOfGraduation,
    courseInterestedIn: saved.courseInterestedIn,
    referral: saved.referral,
    notes: saved.notes,
    consultedBy: saved.consultedBy,
    enquiryDate: saved.enquiryDate,
    status: 'New',
    admissionId: '',
    createdAt: '2026-11-27',
    updatedAt: '2026-11-27',
  }
}

describe('Enquiry education persistence', () => {
  it.each([
    { educationLevel: 'B.Tech', specialization: 'CSE', yearOfGraduation: 'Currently Pursuing', custom: false, email: 'student@example.test' },
    { educationLevel: 'BBA', specialization: 'Finance', yearOfGraduation: '2017', custom: true, email: '' },
  ])('prefills admission education controls and preserves the saved education: $educationLevel', async (education) => {
    const { createElement } = await import(fileURLToPath(new URL('../../node_modules/react/index.js', import.meta.url)))
    const { renderToStaticMarkup } = await import(fileURLToPath(new URL('../../node_modules/react-dom/server.node.js', import.meta.url)))
    const { MemoryRouter } = await import(fileURLToPath(new URL('../../node_modules/react-router-dom/dist/index.mjs', import.meta.url)))
    const { WorkflowContext } = await import(fileURLToPath(new URL('../../src/features/workflow/WorkflowContext.ts', import.meta.url)))
    const { AdmissionForm } = await import(fileURLToPath(new URL('../../src/features/admissions/AdmissionForm.tsx', import.meta.url)))
    const { initialAdmissionForm, getAdmissionEducationPayload } = await import(fileURLToPath(new URL('../../src/features/admissions/admissionFormUtils.ts', import.meta.url)))
    const enquiry = normalizeEnquiryRecord(legacyRecord(encodeEnquiryPayload({ ...payload, ...education })))
    const html = renderToStaticMarkup(createElement(WorkflowContext, {
      value: { admission: null, payment: null, clearWorkflow: vi.fn(), setAdmission: vi.fn(), setPayment: vi.fn() },
    }, createElement(MemoryRouter, null, createElement(AdmissionForm, { mode: 'convert', enquiry }))))
    expect(html).toMatch(new RegExp(`id="email"[^>]*value="${education.email || '@gmail.com'}"`))
    expect(html).toContain('Parents Name')
    expect(html).toContain('Parents Phone Number')
    expect(html).toMatch(/id="parentsPhoneNumber"[^>]*type="tel"/)
    expect(html).not.toContain("Mother&#x27;s Name")
    if (education.custom) {
      expect(html).toMatch(/id="admission-specify-education"[^>]*value="BBA"/)
      expect(html).toMatch(/id="admission-specify-specialization"[^>]*value="Finance"/)
      expect(html).toMatch(/id="admission-specify-graduation"[^>]*value="2017"/)
    } else {
      expect(html).toContain('<option value="B.Tech" selected="">B.Tech</option>')
      expect(html).toContain('<option value="CSE" selected="">CSE</option>')
      expect(html).toContain('<option value="Currently Pursuing" selected="">Currently Pursuing</option>')
    }
    expect(getAdmissionEducationPayload({
      ...initialAdmissionForm,
      degreeCourse: ` ${education.educationLevel} `,
      specialization: ` ${education.specialization} `,
      yearOfPassing: education.yearOfGraduation,
    })).toEqual({
      degreeCourse: `${education.educationLevel} - ${education.specialization}`,
      yearOfPassing: education.yearOfGraduation,
    })
  })

  it('does not add a separator to admission education when specialization is optional and empty', async () => {
    const { initialAdmissionForm, getAdmissionEducationPayload } = await import(fileURLToPath(new URL('../../src/features/admissions/admissionFormUtils.ts', import.meta.url)))
    expect(getAdmissionEducationPayload({ ...initialAdmissionForm, degreeCourse: 'B.Tech' })).toEqual({
      degreeCourse: 'B.Tech', yearOfPassing: '',
    })
  })

  it('retains all education details through a legacy save, reload and status edit', () => {
    const saved = encodeEnquiryPayload(payload)
    const reloaded = normalizeEnquiryRecord(legacyRecord(saved))
    expect(reloaded).toMatchObject({
      educationLevel: 'B.Tech',
      specialization: 'CSE',
      yearOfGraduation: 'Currently Pursuing',
      notes: payload.notes,
    })

    const statusEdit = encodeEnquiryPayload({ ...payload, ...reloaded, status: 'Follow-up' as const })
    expect(statusEdit.status).toBe('Follow-up')
    expect(normalizeEnquiryRecord({ ...legacyRecord(statusEdit), status: statusEdit.status })).toMatchObject({
      educationLevel: payload.educationLevel,
      specialization: payload.specialization,
      yearOfGraduation: payload.yearOfGraduation,
      status: 'Follow-up',
      notes: payload.notes,
    })
    expect(statusEdit.notes).toBe(saved.notes)
  })

  it('uses a non-empty legacy Degree / Course when Education Level is empty', () => {
    const record = normalizeEnquiryRecord({ ...legacyRecord(encodeEnquiryPayload(payload)), educationLevel: ' ', notes: '' })
    expect(record.educationLevel).toBe('B.Tech')
    expect(getEnquiryEducationState(record, 2026).educationLevelChoice).toBe('B.Tech')
  })

  it('initializes custom education and specialization against the rendered options', () => {
    const record = normalizeEnquiryRecord(legacyRecord(encodeEnquiryPayload({
      ...payload, educationLevel: 'BBA', specialization: 'Finance', yearOfGraduation: '2017',
    })))
    const state = getEnquiryEducationState(record, 2026)
    expect(state).toEqual({
      educationLevelChoice: otherOption,
      otherEducationLevel: 'BBA',
      specializationChoice: otherOption,
      otherSpecialization: 'Finance',
      graduationChoice: otherOption,
      otherGraduationYear: '2017',
    })
    expect(getSpecializationOptions(state.educationLevelChoice)).toContain(state.specializationChoice)
  })

  it('opens the actual Edit form with restored custom education, specialization and graduation inputs', async () => {
    const { createElement } = await import(fileURLToPath(new URL('../../node_modules/react/index.js', import.meta.url)))
    const { renderToStaticMarkup } = await import(fileURLToPath(new URL('../../node_modules/react-dom/server.node.js', import.meta.url)))
    const { EnquiryFormModal } = await import(fileURLToPath(new URL('../../src/features/enquiries/EnquiryFormModal.tsx', import.meta.url)))
    const enquiry = normalizeEnquiryRecord(legacyRecord(encodeEnquiryPayload({
      ...payload, educationLevel: 'BBA', specialization: 'Finance', yearOfGraduation: '2017',
    })))
    const html = renderToStaticMarkup(createElement(EnquiryFormModal, {
      enquiry, onClose: vi.fn(), onConvert: vi.fn(), onViewAdmission: vi.fn(), onSaved: vi.fn(),
    }))
    expect(html).toMatch(/id="enquiry-specify-education"[^>]*value="BBA"/)
    expect(html).toMatch(/id="enquiry-specify-specialization"[^>]*value="Finance"/)
    expect(html).toMatch(/id="enquiry-specify-graduation"[^>]*value="2017"/)
    expect(html).not.toContain('[LSA Enquiry Education v1]')
  })

  it.each([null, normalizeEnquiryRecord(legacyRecord(encodeEnquiryPayload(payload)))])(
    'offers a clearly labeled optional college name in new and edited enquiries',
    async (enquiry) => {
      const { createElement } = await import(fileURLToPath(new URL('../../node_modules/react/index.js', import.meta.url)))
      const { renderToStaticMarkup } = await import(fileURLToPath(new URL('../../node_modules/react-dom/server.node.js', import.meta.url)))
      const { EnquiryFormModal } = await import(fileURLToPath(new URL('../../src/features/enquiries/EnquiryFormModal.tsx', import.meta.url)))
      const html = renderToStaticMarkup(createElement(EnquiryFormModal, {
        enquiry, onClose: vi.fn(), onConvert: vi.fn(), onViewAdmission: vi.fn(), onSaved: vi.fn(),
      }))
      expect(html).toMatch(/<label[^>]*for="enquiry-college">College Name<\/label>/)
      const input = html.match(/<input[^>]*id="enquiry-college"[^>]*>/)?.[0]
      expect(input).toContain('name="college"')
      expect(input).toContain(`value="${enquiry?.college ?? ''}"`)
      expect(input).not.toMatch(/\brequired\b/)
      expect(html).not.toContain('id="enquiry-college-message"')
    },
  )

  it('keeps standard dropdown values selected after a reload', () => {
    const record = normalizeEnquiryRecord(legacyRecord(encodeEnquiryPayload({ ...payload, yearOfGraduation: '2026' })))
    expect(getEnquiryEducationState(record, 2026)).toMatchObject({
      educationLevelChoice: 'B.Tech',
      specializationChoice: 'CSE',
      graduationChoice: '2026',
      otherEducationLevel: '',
      otherSpecialization: '',
      otherGraduationYear: '',
    })
  })

  it.each([
    { name: 'new enquiry', enquiry: null, locked: false, dateLocked: false },
    {
      name: 'saved enquiry with empty referral and consultant',
      enquiry: normalizeEnquiryRecord(legacyRecord(encodeEnquiryPayload({ ...payload, referral: '', consultedBy: '' }))),
      locked: false, dateLocked: true,
    },
    {
      name: 'saved custom referral and consultant',
      enquiry: normalizeEnquiryRecord(legacyRecord(encodeEnquiryPayload({
        ...payload, referral: 'Synthetic Referral', consultedBy: 'Synthetic Consultant',
      }))),
      locked: true, dateLocked: true,
    },
  ])('locks saved attribution and dates in $name', async ({ enquiry, locked, dateLocked }) => {
    const { createElement } = await import(fileURLToPath(new URL('../../node_modules/react/index.js', import.meta.url)))
    const { renderToStaticMarkup } = await import(fileURLToPath(new URL('../../node_modules/react-dom/server.node.js', import.meta.url)))
    const { EnquiryFormModal } = await import(fileURLToPath(new URL('../../src/features/enquiries/EnquiryFormModal.tsx', import.meta.url)))
    const html = renderToStaticMarkup(createElement(EnquiryFormModal, {
      enquiry, onClose: vi.fn(), onConvert: vi.fn(), onViewAdmission: vi.fn(), onSaved: vi.fn(),
    }))
    for (const id of ['enquiry-referral', 'enquiry-consulted']) {
      const select = html.match(new RegExp(`<select[^>]*id="${id}"[^>]*>`))?.[0]
      expect(select).toBeDefined()
      expect(/\bdisabled=/i.test(select ?? '')).toBe(locked)
    }
    const date = html.match(/<input[^>]*id="enquiry-date"[^>]*>/)?.[0]
    expect(date).toBeDefined()
    expect(/\breadonly=/i.test(date ?? '')).toBe(dateLocked)
    if (locked) {
      for (const id of ['enquiry-other-referral', 'enquiry-other-consultant']) {
        expect(html.match(new RegExp(`<input[^>]*id="${id}"[^>]*>`))?.[0]).toMatch(/\breadonly=/i)
      }
      expect(html).toContain('value="Synthetic Consultant"')
    }
  })

  it('prefers current dedicated fields over older compatibility details', () => {
    const record = normalizeEnquiryRecord({
      ...legacyRecord(encodeEnquiryPayload(payload)),
      educationLevel: 'MBA',
      specialization: 'Marketing',
      yearOfGraduation: '2025',
    })
    expect(record).toMatchObject({ educationLevel: 'MBA', specialization: 'Marketing', yearOfGraduation: '2025', notes: payload.notes })
  })

  it('replaces old compatibility details when the user changes or clears fields', () => {
    const old = encodeEnquiryPayload(payload)
    const updated = encodeEnquiryPayload({ ...payload, educationLevel: 'MCA', specialization: '', yearOfGraduation: '', notes: old.notes })
    expect(normalizeEnquiryRecord(legacyRecord(updated))).toMatchObject({
      educationLevel: 'MCA', specialization: '', yearOfGraduation: '', notes: payload.notes,
    })
    expect(updated.notes.match(/\[LSA Enquiry Education v1\]:/g)).toHaveLength(1)
  })

  it('preserves ordinary notes and reports damaged compatibility data explicitly', () => {
    expect(normalizeEnquiryRecord({ ...legacyRecord(encodeEnquiryPayload(payload)), notes: payload.notes }).notes).toBe(payload.notes)
    const saved = encodeEnquiryPayload(payload)
    const metadata = saved.notes.split('\n').at(-1)
    expect(() => normalizeEnquiryRecord({ ...legacyRecord(saved), notes: '[LSA Enquiry Education v1]: invalid' })).toThrow('could not be read')
    expect(() => normalizeEnquiryRecord({ ...legacyRecord(saved), notes: '[LSA Enquiry Education v1]: {}' })).toThrow('invalid format')
    expect(() => normalizeEnquiryRecord({ ...legacyRecord(saved), notes: `${saved.notes}\n${metadata}` })).toThrow('duplicate')
  })
})

describe('Enquiry API education compatibility', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.unstubAllEnvs()
    vi.resetModules()
  })

  async function loadApi() {
    vi.resetModules()
    vi.stubEnv('VITE_API_BASE_URL', 'https://api.example.test')
    vi.stubGlobal('window', { setTimeout, clearTimeout })
    const auth = await import(fileURLToPath(new URL('../../src/auth/authService.ts', import.meta.url)))
    auth.setIdToken('synthetic-test-token')
    return import(fileURLToPath(new URL('../../src/services/api.ts', import.meta.url)))
  }

  it('encodes both create and status updates and normalizes subsequent API reads', async () => {
    const api = await loadApi()
    let saved = legacyRecord(encodeEnquiryPayload(payload))
    const requests: Array<Record<string, unknown>> = []
    vi.stubGlobal('fetch', vi.fn(async (_url: string, init: RequestInit) => {
      if (init.method === 'POST') {
        const body = JSON.parse(String(init.body)) as typeof payload & { degreeCourse: string; status?: string }
        requests.push(body)
        saved = { ...legacyRecord(body), status: body.status ?? 'New' }
        return Response.json({ success: true, data: saved })
      }
      return Response.json({ success: true, data: [saved] })
    }))
    const created = await api.createEnquiry(payload)
    expect(created.indexWarning).toBeUndefined()
    const [loaded] = await api.fetchEnquiries()
    const updated = await api.updateEnquiry(loaded.enquiryId, { ...payload, ...loaded, status: 'Follow-up' })
    expect(updated.indexWarning).toBeUndefined()
    const [reloaded] = await api.fetchEnquiries()
    expect(reloaded).toMatchObject({
      educationLevel: payload.educationLevel,
      specialization: payload.specialization,
      yearOfGraduation: payload.yearOfGraduation,
      college: payload.college,
      notes: payload.notes,
      status: 'Follow-up',
    })
    expect(requests[0].degreeCourse).toBe(payload.educationLevel)
    expect(requests[1].status).toBe('Follow-up')
    expect(requests[1].notes).toBe(requests[0].notes)
  })

  it('warns rather than inventing details or suggesting a duplicate save when the server drops education', async () => {
    const api = await loadApi()
    vi.stubGlobal('fetch', vi.fn(async () => Response.json({
      success: true,
      data: { ...legacyRecord(encodeEnquiryPayload(payload)), degreeCourse: '', yearOfGraduation: '', notes: payload.notes },
      indexWarning: 'Index synchronization delayed.',
    })))
    const result = await api.updateEnquiry('ENQ-000001', { ...payload, status: 'Follow-up' })
    expect(result.indexWarning).toContain('Index synchronization delayed.')
    expect(result.indexWarning).toContain('Do not submit again')
    expect(result.data).toMatchObject({ educationLevel: '', specialization: '', yearOfGraduation: '' })
  })
})
