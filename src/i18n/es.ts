export const es = {
  app_title: 'LUMEN',
  app_tagline: 'Sobrevive a la noche infinita',
  loading: 'Encendiendo la llama…',
  play: 'Jugar',
  sparks: 'Chispas',
  settings: 'Ajustes',
  language: 'Idioma',
  sound: 'Sonido',
  music: 'Música',
  haptics: 'Vibración',
  on: 'Sí',
  off: 'No',
  back: 'Volver',
  reset_save: 'Borrar progreso',
  reset_confirm: '¿Seguro que quieres borrar todo tu progreso? No se puede deshacer.',
  save_backends: 'Guardado',
  save_cloud: 'Nube de Telegram',
  save_local: 'Este dispositivo',
  dev_only: 'Solo desarrollo',
  debug: 'Depuración',

  // Partida
  level_short: 'Nv',
  level_up: '¡Nivel {n}!',
  choose_upgrade: 'Elige una mejora',
  new_tag: 'Nuevo',
  max_tag: 'MÁX',
  victory: '¡Has sobrevivido a la noche!',
  defeat: 'La llama se apagó…',
  time_survived: 'Tiempo',
  enemies_defeated: 'Derrotados',
  level_reached: 'Nivel',
  sparks_earned: 'Chispas ganadas',
  continue: 'Continuar',
  retry: 'Otra noche',
  quit_run: 'Abandonar',
  paused: 'Pausa',
  resume: 'Seguir',
  keyboard_hint: 'WASD / flechas para moverte',

  // Notas de nivel
  lv_new: 'Nuevo',
  lv_dmg: 'Más potencia',
  lv_count: '+1 proyectil',
  lv_cd: 'Dispara más rápido',
  lv_pierce: 'Atraviesa enemigos',
  lv_size: 'Más grande',
  lv_speed: 'Más veloz',

  // Armas
  w_spark: 'Chispa',
  w_spark_desc: 'Lanza chispas al enemigo más cercano.',

  // Pasivas
  p_vigor: 'Vigor',
  p_vigor_desc: '+20% vida máxima.',
  p_swift: 'Ligereza',
  p_swift_desc: '+10% velocidad de movimiento.',
  p_might: 'Fervor',
  p_might_desc: '+12% daño.',
  p_lodestone: 'Imán',
  p_lodestone_desc: '+35% radio de recogida.',
  p_haste: 'Prisa',
  p_haste_desc: '-8% tiempo entre ataques.',
  p_bark: 'Corteza',
  p_bark_desc: '-1 daño recibido por golpe.',

  // Enemigos y personajes
  e_shade: 'Sombra',
  c_ember: 'Ascua',
} as const;

export type TranslationKey = keyof typeof es;
