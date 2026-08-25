# Bottle picker for Tilda

Файлы функции выбора атомайзера:

- `bottles.json` — номера, названия, категории, цены и пути к изображениям;
- `tilda-bottle-picker-v6.css` — оформление интерфейса;
- `tilda-bottle-picker-v6.js` — логика интерфейса и встроенная конфигурация;
- `full/` — полноразмерные изображения;
- `thumbs/` — уменьшенные изображения для карточек.

Подключение в Tilda:

```html
<link rel="preconnect" href="https://cdn.jsdelivr.net" crossorigin>
<link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/nikitabratischev/files@main/bottle-picker/tilda-bottle-picker-v6.css">
<link rel="preload" as="image" href="https://cdn.jsdelivr.net/gh/nikitabratischev/files@main/bottle-picker/thumbs/01.webp">
<script defer src="https://cdn.jsdelivr.net/gh/nikitabratischev/files@main/bottle-picker/tilda-bottle-picker-v6.js"></script>
```
