export const TRANSLATIONS = {
  en: {
    brandTitle: 'Galala Academic Registry',
    brandSub: 'Student Management System',
    navCatalogue: 'Course Catalogue',
    navSchedule: 'My Schedule',
    navCoursework: 'Coursework & Exams',
    navTranscript: 'Transcript & Degree',
    navPetitionsFinance: 'Petitions & Finance',
    navInstructorOfferings: 'My Offerings & Grading',
    navAdvising: 'Advising & Office Hours',
    navAdminConsole: 'Operations Console',
    inbox: 'Inbox',
    security: 'Security',
    signOut: 'Sign out',
    menu: 'Menu',
    verifyCredential: 'Verify Official Credential',
    roleStudent: 'student',
    roleInstructor: 'instructor',
    roleAdmin: 'admin'
  },
  ar: {
    brandTitle: 'سجل جامعة الجلالة الأكاديمي',
    brandSub: 'نظام إدارة شؤون الطلاب',
    navCatalogue: 'دليل المقررات',
    navSchedule: 'جدولي الدراسي',
    navCoursework: 'التقييمات والاختبارات',
    navTranscript: 'السجل والتخرج',
    navPetitionsFinance: 'الالتماسات والمالية',
    navInstructorOfferings: 'مقرراتي والدرجات',
    navAdvising: 'الإرشاد والساعات المكتبية',
    navAdminConsole: 'لوحة العمليات الإدارية',
    inbox: 'الرسائل',
    security: 'الأمان',
    signOut: 'تسجيل الخروج',
    menu: 'القائمة',
    verifyCredential: 'التحقق من الشهادة الرسمية',
    roleStudent: 'طالب',
    roleInstructor: 'عضو هيئة تدريس',
    roleAdmin: 'مسؤول النظام'
  }
};

export function t(lang, key) {
  return TRANSLATIONS[lang]?.[key] || TRANSLATIONS.en[key] || key;
}
