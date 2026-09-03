import { db } from './firebaseConfig.js'; // Firebase конфиг вынесен отдельно
import { collection, addDoc, updateDoc, deleteDoc, doc, onSnapshot, serverTimestamp } from 'firebase/firestore';

// Загрузка расписания из data.json
export async function loadScheduleData() {
  try {
    const response = await fetch('data.json?t=' + Date.now());
    if (!response.ok) throw new Error('Не удалось загрузить data.json');
    const data = await response.json();

    // Преобразуем новую структуру schedule в плоский массив lessons
    let lessons = [];
    if (data.schedule && Array.isArray(data.schedule)) {
      data.schedule.forEach(day => {
        if (day.lessons) {
          day.lessons.forEach(lesson => {
            lessons.push({
              day: day.day,
              slot: lesson.slot,
              name: lesson.name,
              room: lesson.room,
              teacher: lesson.teacher,
              weekType: lesson.weekType,
              dateStart: lesson.dateStart || undefined,
              dateEnd: lesson.dateEnd || undefined,
            });
          });
        }
      });
    } else if (data.lessons) {
      lessons = data.lessons;
    }

    return {
      timeSlots: data.timeSlots,
      holidays: data.holidays || [],
      lessons,
      startWeekReference: new Date(data.startWeekReference),
    };
  } catch (error) {
    console.warn('Ошибка загрузки данных, использую запасные:', error);
    return getFallbackData();
  }
}

function getFallbackData() {
  return {
    timeSlots: [
      { start: '10:00', end: '11:20' },
      { start: '11:30', end: '12:50' },
      { start: '13:00', end: '14:20' },
      { start: '15:00', end: '16:20' },
      { start: '16:30', end: '17:50' },
    ],
    holidays: [],
    lessons: [],
    startWeekReference: new Date('2026-08-31'),
  };
}

// ---------- Работа с Firestore (ДЗ) ----------

let homeworksData = [];
let hwListeners = [];

export function listenHomeworks(callback) {
  const unsub = onSnapshot(collection(db, 'homeworks'), (snapshot) => {
    const hw = [];
    snapshot.forEach(doc => hw.push({ id: doc.id, ...doc.data() }));
    homeworksData = hw;
    callback(hw);
  }, error => console.error('Ошибка загрузки ДЗ:', error));
  hwListeners.push(unsub);
  return unsub;
}

export async function addHomework(hw) {
  const docRef = await addDoc(collection(db, 'homeworks'), {
    ...hw,
    done: false,
    createdAt: serverTimestamp(),
  });
  return docRef.id;
}

export async function updateHomework(id, data) {
  await updateDoc(doc(db, 'homeworks', id), data);
}

export async function deleteHomework(id) {
  await deleteDoc(doc(db, 'homeworks', id));
}

export async function toggleHomeworkDone(id, currentDone) {
  await updateHomework(id, { done: !currentDone });
}

export function getHomeworksData() {
  return homeworksData;
}