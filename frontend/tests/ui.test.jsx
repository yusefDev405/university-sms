import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { LoginPage } from '../src/pages/LoginPage.jsx';
import { TranscriptPage } from '../src/pages/student/TranscriptPage.jsx';
import { projectWhatIfGpa } from '../src/utils/gpa.js';
import { formatMeetings } from '../src/utils/schedule.js';

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('Frontend utilities', () => {
  it('computes projected What-If GPA accurately and ignores withdrawn courses', () => {
    const existing = [
      { credits: 3, grade_points: 4.0, status: 'completed' },
      { credits: 3, grade_points: null, status: 'withdrawn' }
    ];
    const res = projectWhatIfGpa(existing, [{ credits: 3, gradeLetter: 'B' }]);
    expect(res).toEqual({ gpa: 3.5, totalCredits: 6 });
  });

  it('formats offering meeting slots cleanly', () => {
    expect(formatMeetings([])).toBe('TBA');
    expect(
      formatMeetings([{ day_of_week: 1, start_time: '10:00', end_time: '11:30' }])
    ).toBe('Mon 10:00–11:30');
  });
});

describe('LoginPage component', () => {
  it('auto-fills demo student credentials and toggles password visibility', () => {
    render(<LoginPage onSuccess={() => {}} />);

    const demoBtn = screen.getByRole('button', { name: /Use Student \(Nadia Mansour\)/i });
    fireEvent.click(demoBtn);

    const emailInput = screen.getByLabelText(/University Email/i);
    const passwordInput = screen.getByLabelText(/^Password$/i);
    expect(emailInput.value).toBe('nadia.mansour@galala.edu.eg');
    expect(passwordInput.value).toBe('Student123!');
    expect(passwordInput.type).toBe('password');

    const toggleBtn = screen.getByRole('button', { name: /^Show$/i });
    fireEvent.click(toggleBtn);
    expect(passwordInput.type).toBe('text');
  });
});

describe('TranscriptPage component', () => {
  it('renders transcript, degree audit, and live What-If GPA simulator', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url) => {
        if (String(url).includes('/me/transcript')) {
          return {
            ok: true,
            status: 200,
            text: async () =>
              JSON.stringify({
                data: {
                  student: {
                    id: 1,
                    student_number: '2024001',
                    first_name: 'Nadia',
                    last_name: 'Mansour',
                    department_code: 'CS',
                    department_name: 'Computer Science'
                  },
                  summary: {
                    gpa: 4.0,
                    creditsAttempted: 3,
                    creditsEarned: 3,
                    departmentRank: 1,
                    departmentTotal: 4,
                    standing: "Dean's List",
                    maxTermCredits: 18
                  },
                  courses: [
                    {
                      enrollment_id: 1,
                      course_code: 'CS101',
                      course_title: 'Intro to Programming',
                      term_name: 'Fall 2026',
                      credits: 3,
                      status: 'completed',
                      grade_letter: 'A',
                      grade_points: 4.0
                    }
                  ]
                }
              })
          };
        }
        return {
          ok: true,
          status: 200,
          text: async () =>
            JSON.stringify({
              data: {
                totalRequiredCredits: 6,
                completedCredits: 3,
                inProgressCredits: 3,
                remainingCredits: 3,
                courses: [
                  { id: 1, code: 'CS101', title: 'Intro to Programming', credits: 3, is_completed: true, is_in_progress: false },
                  { id: 2, code: 'CS201', title: 'Data Structures', credits: 3, is_completed: false, is_in_progress: true }
                ]
              }
            })
        };
      })
    );

    render(<TranscriptPage notify={() => {}} />);
    await waitFor(() => {
      expect(screen.getByText(/Nadia Mansour/i)).toBeTruthy();
    });
    expect(screen.getByText(/Degree Audit/i)).toBeTruthy();
    expect(screen.getByText(/What-If/i)).toBeTruthy();
  });
});
