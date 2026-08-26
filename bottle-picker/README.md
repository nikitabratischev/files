# Bottle picker for Tilda

Файлы функции выбора атомайзера:

- `bottles.json` — номера, названия, категории, цены и пути к изображениям;
- `tilda-bottle-picker-v7.css` — актуальное оформление интерфейса;
- `tilda-bottle-picker-v7.js` — актуальная логика и встроенная конфигурация с объёмом 8 мл;
- `tilda-bottle-picker-v6.css` и `tilda-bottle-picker-v6.js` — предыдущая резервная версия;
- `full/` — полноразмерные изображения;
- `thumbs/` — уменьшенные изображения для карточек.

Подключение в Tilda:

```html
<link rel="preconnect" href="https://cdn.jsdelivr.net" crossorigin>
<link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/nikitabratischev/files@main/bottle-picker/tilda-bottle-picker-v7.css">
<link rel="preload" as="image" href="https://cdn.jsdelivr.net/gh/nikitabratischev/files@main/bottle-picker/thumbs/01.webp">
<script defer src="https://cdn.jsdelivr.net/gh/nikitabratischev/files@main/bottle-picker/tilda-bottle-picker-v7.js"></script>
```

## Объёмы

- 2 мл: `01`;
- 5 мл: `02–10`;
- 8 мл: `41–49`;
- 10 мл: `11–40`, `50–58`.
