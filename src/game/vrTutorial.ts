import { VRControllerProfile, VRTrackingMode } from './vr';

export type VRTutorialStepId = 'movement' | 'interaction' | 'menus';

export interface VRTutorialBinding {
  id: string;
  hand: 'left' | 'right' | 'both';
  controlName: string;
  picoLabel: string;
  questLabel: string;
  handGestureLabel: string;
  actionTitle: string;
  description: string;
  keyboardFallback: string;
}

export interface VRTutorialStep {
  id: VRTutorialStepId;
  index: number;
  title: string;
  subtitle: string;
  focusZone: 'sticks_teleport' | 'trigger_wrist' | 'lasers_menu';
  bindings: VRTutorialBinding[];
  practicePrompt: string;
}

export const VR_TUTORIAL_STORAGE_KEY = 'blox_vr_tutorial_completed_v1';

export function hasCompletedVRTutorial(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return window.localStorage.getItem(VR_TUTORIAL_STORAGE_KEY) === 'true';
  } catch {
    return false;
  }
}

export function setVRTutorialCompleted(completed: boolean): void {
  if (typeof window === 'undefined') return;
  try {
    if (completed) {
      window.localStorage.setItem(VR_TUTORIAL_STORAGE_KEY, 'true');
    } else {
      window.localStorage.removeItem(VR_TUTORIAL_STORAGE_KEY);
    }
  } catch {
    // Ignore storage restriction errors (e.g. strict WebView)
  }
}

export const VR_TUTORIAL_STEPS: readonly VRTutorialStep[] = [
  {
    id: 'movement',
    index: 1,
    title: 'Движение, повороты и VR-телепорт',
    subtitle: 'Плавная ходьба левым стиком, комфортный Snap-поворот и прыжок телепортом без укачивания.',
    focusZone: 'sticks_teleport',
    practicePrompt: 'Попробуйте повернуть камеру (Snap-поворот) или выполнить телепорт по лучу прямо сейчас.',
    bindings: [
      {
        id: 'move_stick',
        hand: 'left',
        controlName: 'Левый стик',
        picoLabel: 'PICO L Thumbstick',
        questLabel: 'Touch L Thumbstick',
        handGestureLabel: 'Наклон головы / взгляд вперёд + удержание щипка L',
        actionTitle: 'Плавное движение',
        description: 'Перемещение вперёд, назад и стрейф в мировых координатах.',
        keyboardFallback: 'W A S D',
      },
      {
        id: 'snap_turn',
        hand: 'right',
        controlName: 'Правый стик влево/вправо',
        picoLabel: 'PICO R Thumbstick X',
        questLabel: 'Touch R Thumbstick X',
        handGestureLabel: 'Свайп запястьем или поворот головой в шлеме',
        actionTitle: 'Snap-поворот (30° / 45° / 90°)',
        description: 'Мгновенный дискретный поворот камеры с анти-укачивающей виньеткой.',
        keyboardFallback: 'Q / X',
      },
      {
        id: 'teleport',
        hand: 'left',
        controlName: 'Левый Хват (Grip) или кнопка [B]',
        picoLabel: 'Grip L (Squeeze) / [B]',
        questLabel: 'Grip L / [B]',
        handGestureLabel: 'Удержание щипка левой рукой (навести луч на пол)',
        actionTitle: 'Телепорт по зелёному кольцу',
        description: 'Наведите луч на пол (1.1–18 м) и нажмите Grip или [B] для мгновенного перемещения.',
        keyboardFallback: 'T',
      },
      {
        id: 'jump_crouch',
        hand: 'right',
        controlName: 'Кнопка [A] (справа) / [X] (слева)',
        picoLabel: 'Кнопка [A] R / [X] L',
        questLabel: 'Button [A] R / [X] L',
        handGestureLabel: 'Короткий щипок средним пальцем',
        actionTitle: 'Прыжок (Obby) / Присед (DOORS)',
        description: 'В паркуре и Лаве [A] — прыжок; в DOORS [A] и [X] — тихий присед от Фигуры.',
        keyboardFallback: 'Пробел / C',
      },
    ],
  },
  {
    id: 'interaction',
    index: 2,
    title: 'Жесты рук, предметы и часы HUD',
    subtitle: 'Открывайте двери, светите фонариком в темноте и считывайте телеметрию прямо с левого запястья.',
    focusZone: 'trigger_wrist',
    practicePrompt: 'Переключите режим рук/контроллеров и проверьте виброотклик PICO HyperSense.',
    bindings: [
      {
        id: 'primary_trigger',
        hand: 'right',
        controlName: 'Правый Курок (Trigger)',
        picoLabel: 'Trigger R (индекс)',
        questLabel: 'Index Trigger R',
        handGestureLabel: 'Щипок правым большим и указательным пальцами',
        actionTitle: 'Взаимодействие / Удар / Сбор',
        description: 'Открывает двери в DOORS, шкафы, рычаги и активирует меч или сачок.',
        keyboardFallback: 'E / ЛКМ',
      },
      {
        id: 'flashlight',
        hand: 'left',
        controlName: 'Кнопка [Y] (слева) или [B] (в DOORS)',
        picoLabel: 'Кнопка [Y] L / [B] R',
        questLabel: 'Button [Y] L / [B] R',
        handGestureLabel: 'Быстрый двойной щипок левой рукой',
        actionTitle: 'Тактический фонарик в руке',
        description: 'Луч фонарика направлен прямо вдоль правого контроллера или кисти.',
        keyboardFallback: 'F',
      },
      {
        id: 'wrist_watch',
        hand: 'left',
        controlName: 'Голографические 3D-часы на левой руке',
        picoLabel: 'Левое запястье 6DoF',
        questLabel: 'Left Wrist HUD',
        handGestureLabel: 'Поверните левую ладонь к себе',
        actionTitle: 'Живой экран HP, монет и двери',
        description: 'Показывает здоровье, счётчик монет, номер двери DOORS или этап Obby прямо в 3D.',
        keyboardFallback: 'Смотреть на левую руку',
      },
      {
        id: 'haptics',
        hand: 'both',
        controlName: 'Тактильная отдача (Haptics)',
        picoLabel: 'PICO HyperSense (широкополосный мотор)',
        questLabel: 'Quest Touch Haptics',
        handGestureLabel: 'Визуальная вспышка на сфере щипка',
        actionTitle: 'Отклик на прыжки и телепорт',
        description: 'Контроллеры вибрируют при открытии дверей, телепорте и столкновении со стеной.',
        keyboardFallback: 'Кнопка «Вибро»',
      },
      {
        id: 'hand_gestures',
        hand: 'right',
        controlName: 'Жесты рук и VR-эмоции (👍 / 👋 / ✌️)',
        picoLabel: 'Grip R без курка (👍) / Взмах R (👋)',
        questLabel: 'Grip R без курка (👍) / Взмах R (👋)',
        handGestureLabel: 'Палец вверх 👍, Взмах ладонью 👋, Жест V ✌️',
        actionTitle: 'Уникальные жесты-эмоции в 3D мире',
        description: 'Показывайте палец вверх, машите рукой или жест Мир — кисть в VR и 3D-персонаж выполнят анимацию для всех игроков.',
        keyboardFallback: 'Панель жестов / [G]',
      },
    ],
  },
  {
    id: 'menus',
    index: 3,
    title: 'Навигация по меню и комфорт шлема',
    subtitle: 'Управляйте интерфейсом лазерными лучами, настраивайте IPD линз и границу комнаты Guardian.',
    focusZone: 'lasers_menu',
    practicePrompt: 'Выберите модель контроллеров (PICO 4 или Quest), проверьте режим линз Стерео SBS и завершите обучение.',
    bindings: [
      {
        id: 'laser_ui',
        hand: 'both',
        controlName: 'Лазерные указатели контроллеров',
        picoLabel: 'Луч R + Trigger R',
        questLabel: 'Ray + Index Trigger',
        handGestureLabel: 'Луч из указательного пальца + Щипок',
        actionTitle: 'Выбор кнопок и вкладок в меню',
        description: 'Наведите голубой (L) или янтарный (R) луч на кнопку HUD и нажмите курок или щипок.',
        keyboardFallback: 'Курсор мыши',
      },
      {
        id: 'menu_btn',
        hand: 'left',
        controlName: 'Системная кнопка меню / паузы',
        picoLabel: 'PICO Menu (слева)',
        questLabel: 'Quest Menu (слева)',
        handGestureLabel: 'Жест ладонью к лицу + щипок',
        actionTitle: 'Пауза, VR-центр и выход в лобби',
        description: 'Быстрый вызов паузы, смены игры или переключения между 2D и 3D VR.',
        keyboardFallback: 'Esc / V',
      },
      {
        id: 'optics_ipd',
        hand: 'both',
        controlName: 'Pancake-оптика и межзрачковое расстояние (IPD)',
        picoLabel: 'Моторизованный IPD PICO 4 (58–72 мм)',
        questLabel: 'Регулировка линз (54–74 мм)',
        handGestureLabel: 'Настройка через VR-центр',
        actionTitle: 'Стерео SBS для 2 глаз без двоения',
        description: 'Переключайте Моно 6DoF и Стерео SBS под линзы вашего шлема и настраивайте ползунок IPD.',
        keyboardFallback: 'Панель VR [V]',
      },
      {
        id: 'guardian_recenter',
        hand: 'both',
        controlName: 'Граница комнаты Guardian и центрирование',
        picoLabel: 'PICO Guardian + Seethrough сетка',
        questLabel: 'Guardian Boundary Ring',
        handGestureLabel: 'Автоматический круг безопасности у ног',
        actionTitle: 'Безопасная зона игры',
        description: 'Голубое кольцо на полу краснеет при приближении к препятствиям; кнопка «Центрировать» выравнивает взгляд.',
        keyboardFallback: 'Центрировать',
      },
    ],
  },
];

export function formatBindingControlLabel(
  binding: VRTutorialBinding,
  profile: VRControllerProfile,
  trackingMode: VRTrackingMode
): string {
  if (trackingMode === 'hands') {
    return binding.handGestureLabel;
  }
  return profile === 'pico4' ? binding.picoLabel : binding.questLabel;
}
