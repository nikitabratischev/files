# Фотографии каталога doyouknow.su

Папка подготовлена для загрузки в корень репозитория:

nikitabratischev/files

Итоговый путь в репозитории должен быть ровно `catalog-images/`.

## Содержимое

- `catalog-full/` — полноразмерные WebP до 1200×1200 px для страницы товара и галереи.
- `catalog-thumbs/` — лёгкие WebP до 480×480 px для карточек каталога.
- `photos.json` — готовая карта Tilda UID → full/thumbnail URL.
- `photos-map.csv` — таблица для проверки и сопоставления.

## Имена файлов

`<Tilda UID>-<номер фотографии>.webp`

Пример: `333888779411-01.webp`.

После загрузки проверьте, что открывается:

https://raw.githubusercontent.com/nikitabratischev/files/main/catalog-images/catalog-thumbs/333888779411-01.webp

Не загружайте ZIP как один файл: распакуйте его и загрузите папку `catalog-images` целиком через GitHub Desktop или git.
