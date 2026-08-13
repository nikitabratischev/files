(function () {
  'use strict';

  /* Не запускаем второй экземпляр, если код подключён и глобально, и блоком T123. */
  if (window.__dbpBottlePickerInitialized) return;
  window.__dbpBottlePickerInitialized = true;

  const BOTTLES_URL = 'https://raw.githubusercontent.com/nikitabratischev/files/main/bottles.json';
  /*
    Каталожный попап и прямая страница /tproduct/ используют разные контейнеры.
    Поддерживаем оба варианта одним интерфейсом.
  */
  const PRODUCT_SELECTOR = [
    '.t-store__prod-popup__container',
    '.t-store__product-snippet.js-store-product',
    '.t-store__product-snippet.js-product'
  ].join(', ');
  const INFO_SELECTOR = '.t-store__prod-popup__info';
  const VOLUME_OPTION_SELECTOR = '.js-product-edition-option[data-edition-option-id="Объем, мл"]';
  const STORAGE_PREFIX = 'dbp-selected-bottle:';
  const READY_CHECK_INTERVAL = 500;
  const READY_REQUIRED_MATCHES = 3;
  let bottleConfigPromise = null;
  const fullImagePromises = new Map();
  const readiness = new WeakMap();

  function getProductIdentity(popup) {
    const selectors = [
      '[data-product-gen-uid]',
      '[data-product-uid]',
      '[data-product-lid]',
      '[data-product-id]'
    ];
    const attributes = [
      'data-product-gen-uid',
      'data-product-uid',
      'data-product-lid',
      'data-product-id'
    ];

    for (let i = 0; i < selectors.length; i += 1) {
      const node = popup.matches(selectors[i]) ? popup : popup.querySelector(selectors[i]);
      if (!node) continue;
      for (let j = 0; j < attributes.length; j += 1) {
        const value = node.getAttribute(attributes[j]);
        if (value) return value;
      }
    }

    const title = popup.querySelector(
      '.js-store-prod-name, .t-store__prod-popup__name, .t-store__prod-popup__title'
    );
    if (title && title.textContent.trim()) return title.textContent.trim();
    return window.location.hash || 'product';
  }

  function getBottleStorageKey(popup, volume) {
    return STORAGE_PREFIX + window.location.pathname + ':' +
      getProductIdentity(popup) + ':' + volume;
  }

  function getVolumeStorageKey(popup) {
    return STORAGE_PREFIX + window.location.pathname + ':' +
      getProductIdentity(popup) + ':volume';
  }

  function getSavedBottleId(popup, volume) {
    try {
      return window.localStorage.getItem(getBottleStorageKey(popup, volume));
    } catch (error) {
      return null;
    }
  }

  function saveBottleId(popup, volume, bottleId) {
    if (!volume || !bottleId) return;
    try {
      window.localStorage.setItem(getBottleStorageKey(popup, volume), bottleId);
      window.localStorage.setItem(getVolumeStorageKey(popup), volume);
    } catch (error) {
      // В приватном режиме localStorage может быть недоступен.
    }
  }

  function restoreSelectedVolume(popup) {
    let savedVolume = null;
    try {
      savedVolume = window.localStorage.getItem(getVolumeStorageKey(popup));
    } catch (error) {
      return;
    }
    if (!savedVolume) return;

    const option = popup.querySelector(VOLUME_OPTION_SELECTOR);
    if (!option) return;
    const radios = option.querySelectorAll('input[type="radio"]');
    for (let i = 0; i < radios.length; i += 1) {
      if (String(radios[i].value).trim() !== savedVolume) continue;
      radios[i].checked = true;
      radios[i].dispatchEvent(new Event('change', { bubbles: true }));
      return;
    }

    const select = option.querySelector('select');
    if (select && Array.from(select.options).some(function (item) {
      return String(item.value).trim() === savedVolume;
    })) {
      select.value = savedVolume;
      select.dispatchEvent(new Event('change', { bubbles: true }));
    }
  }

  function getBottleCaption(bottle) {
    const categoryNames = {
      'Базовые': 'Базовый',
      'Кожа': 'Кожаный',
      'Вращающиеся': 'Вращающийся',
      'С колпачком': 'С колпачком'
    };
    const prefix = categoryNames[bottle.category] || bottle.category || '';
    return (prefix + ' ' + bottle.title).trim();
  }

  function preloadFullImage(src) {
    if (!src) return Promise.resolve('');
    if (fullImagePromises.has(src)) return fullImagePromises.get(src);

    const promise = new Promise(function (resolve, reject) {
      const image = new Image();
      image.decoding = 'async';
      image.onload = function () {
        if (typeof image.decode === 'function') {
          image.decode().then(function () { resolve(src); }).catch(function () { resolve(src); });
        } else {
          resolve(src);
        }
      };
      image.onerror = reject;
      image.src = src;
      if (image.complete && image.naturalWidth) {
        if (typeof image.decode === 'function') {
          image.decode().then(function () { resolve(src); }).catch(function () { resolve(src); });
        } else {
          resolve(src);
        }
      }
    }).catch(function () {
      fullImagePromises.delete(src);
      return '';
    });

    fullImagePromises.set(src, promise);
    return promise;
  }

  function openBottleImage(src, previewSrc, alt, captionText) {
    const existing = document.querySelector('.dbp-lightbox');
    if (existing) existing.remove();

    const lightbox = document.createElement('button');
    lightbox.type = 'button';
    lightbox.className = 'dbp-lightbox';
    lightbox.setAttribute('aria-label', 'Закрыть увеличенное изображение');

    const image = document.createElement('img');
    image.src = previewSrc || src;
    image.alt = alt || '';
    image.decoding = 'async';

    const caption = document.createElement('span');
    caption.className = 'dbp-lightbox__caption';
    caption.textContent = captionText || alt || '';

    lightbox.append(image, caption);
    lightbox.addEventListener('click', function () {
      if (lightbox.classList.contains('is-closing')) return;
      lightbox.classList.add('is-closing');
      window.setTimeout(function () {
        lightbox.remove();
      }, 180);
    });
    document.body.appendChild(lightbox);

    preloadFullImage(src).then(function (loadedSrc) {
      if (!loadedSrc || !lightbox.isConnected) return;
      image.src = loadedSrc;
    });
  }

  function loadBottles() {
    if (!bottleConfigPromise) {
      bottleConfigPromise = fetch(BOTTLES_URL, { cache: 'no-store' })
        .then(function (response) {
          if (!response.ok) throw new Error('HTTP ' + response.status);
          return response.json();
        })
        .then(function (data) {
          if (!data || !data.volumes) throw new Error('Некорректный bottles.json');
          return data;
        })
        .catch(function (error) {
          bottleConfigPromise = null;
          throw error;
        });
    }
    return bottleConfigPromise;
  }

  function getSelectedVolume(popup) {
    const checked = popup.querySelector(VOLUME_OPTION_SELECTOR + ' input[type="radio"]:checked');
    if (checked) return String(checked.value || '').trim();
    const select = popup.querySelector(VOLUME_OPTION_SELECTOR + ' select');
    return select ? String(select.value || '').trim() : '';
  }

  function syncCategoryColor(popup, picker) {
    const selectors = [
      '.t-store__prod-popup__brand',
      '.js-store-prod-brand',
      '.t-store__prod-popup__sku',
      '.js-store-prod-sku',
      '.t-store__prod-popup__info [data-product-brand]',
      '.t-store__prod-popup__info [data-product-sku]'
    ];

    for (let i = 0; i < selectors.length; i += 1) {
      const reference = popup.querySelector(selectors[i]);
      if (!reference) continue;
      const color = window.getComputedStyle(reference).color;
      if (color && color !== 'rgba(0, 0, 0, 0)') {
        picker.style.setProperty('--dbp-meta-color', color);
        return;
      }
    }
  }

  function normalizeBottleValue(value) {
    return String(value || '')
      .replace(/\u00a0/g, ' ')
      .replace(/\s*=\+\s*/g, '=+')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function findNativeBottleWrapper(popup) {
    const wrappers = popup.querySelectorAll(
      '.js-product-option, .t-product__option, .js-product-edition-option'
    );

    for (let i = 0; i < wrappers.length; i += 1) {
      const wrapper = wrappers[i];
      const attributeTitle =
        wrapper.getAttribute('data-edition-option-id') ||
        wrapper.getAttribute('data-option-title') ||
        wrapper.getAttribute('data-product-option-title') || '';
      const titleNode = wrapper.querySelector(
        '.js-product-option-name, .js-product-edition-option-name, ' +
        '.t-product__option-title, .t-product__option-title_simple, label'
      );
      const visibleTitle = titleNode ? titleNode.textContent : '';

      if (
        normalizeBottleValue(attributeTitle).toLowerCase() === 'флакон' ||
        normalizeBottleValue(visibleTitle).toLowerCase() === 'флакон'
      ) {
        return wrapper;
      }
    }

    return null;
  }

  function getNativeBottleSelect(popup) {
    const wrapper = findNativeBottleWrapper(popup);
    if (!wrapper) return null;
    return wrapper.querySelector(
      'select.js-product-option-variants, ' +
      'select.js-product-edition-option-variants, select'
    );
  }

  function getBottleCode(bottle) {
    return normalizeBottleValue(
      bottle.tildaCode || bottle.tildaValue || bottle.id || ''
    ).split('=')[0].trim();
  }

  function findNativeBottleOption(select, bottle) {
    const code = getBottleCode(bottle);
    return Array.from(select.options).find(function (option) {
      return normalizeBottleValue(option.value) === code ||
        normalizeBottleValue(option.textContent) === code;
    }) || null;
  }

  function getNativeSurcharge(option) {
    if (!option) return 0;
    return Number(
      String(option.getAttribute('data-product-variant-price') || '0')
        .replace(',', '.')
        .replace(/[^\d.-]/g, '')
    ) || 0;
  }

  function setSelectedBottle(popup, picker, bottle) {
    const select = getNativeBottleSelect(popup);
    if (!select) {
      console.warn('Не найдена штатная опция Tilda «Флакон»');
      return;
    }

    const nativeOption = findNativeBottleOption(select, bottle);
    if (!nativeOption) {
      console.warn('В штатной опции Tilda нет номера флакона:', getBottleCode(bottle));
      return;
    }

    /* Единственное изменение штатного интерфейса: выбираем готовую option и даём Tilda обработать change. */
    if (select.value !== nativeOption.value) {
      select.value = nativeOption.value;
      select.dispatchEvent(new Event('change', { bubbles: true }));
    }

    picker.dataset.selectedBottleId = bottle.id;
    saveBottleId(popup, getSelectedVolume(popup), bottle.id);

    picker.querySelectorAll('.dbp-option').forEach(function (button) {
      const selected = button.dataset.bottleId === bottle.id;
      button.classList.toggle('is-selected', selected);
      button.setAttribute('aria-pressed', selected ? 'true' : 'false');
    });
  }

  function renderOptions(popup, picker, volume, options) {
    const grid = picker.querySelector('.dbp-picker__grid');
    grid.innerHTML = '';

    const select = getNativeBottleSelect(popup);
    if (!select) {
      grid.innerHTML =
        '<div class="dbp-picker__status is-error">' +
          'Не найдена опция «Флакон» в карточке Tilda.' +
        '</div>';
      return;
    }
    const availableOptions = options.filter(function (bottle) {
      return Boolean(findNativeBottleOption(select, bottle));
    });
    if (!availableOptions.length) {
      const unavailableWrapper = findNativeBottleWrapper(popup);
      if (unavailableWrapper) unavailableWrapper.classList.remove('dbp-picker__native-option');
      grid.innerHTML =
        '<div class="dbp-picker__status is-error">' +
          'Номера флаконов не совпадают с опциями товара в Tilda.' +
        '</div>';
      return;
    }

    const categoryNames = [];
    availableOptions.forEach(function (bottle) {
      const category = bottle.category || 'Флаконы';
      if (categoryNames.indexOf(category) === -1) categoryNames.push(category);
    });

    categoryNames.forEach(function (category) {
      const section = document.createElement('section');
      section.className = 'dbp-category';

      const heading = document.createElement('h5');
      heading.className = 'dbp-category__title';
      heading.textContent = category;

      const categoryGrid = document.createElement('div');
      categoryGrid.className = 'dbp-category__options';
      section.append(heading, categoryGrid);
      grid.appendChild(section);

      availableOptions.filter(function (bottle) {
        return (bottle.category || 'Флаконы') === category;
      }).forEach(function (bottle) {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'dbp-option';
        button.dataset.bottleId = bottle.id;
        button.setAttribute('aria-pressed', 'false');

        const media = document.createElement('span');
        media.className = 'dbp-option__media';
        if (bottle.image) {
          media.classList.add('has-image');
          const image = document.createElement('img');
          image.src = bottle.thumbnail || bottle.image;
          image.alt = bottle.title;
          image.loading = 'lazy';

          const zoom = document.createElement('span');
          zoom.className = 'dbp-option__zoom';
          zoom.setAttribute('aria-hidden', 'true');
          zoom.innerHTML =
            '<svg viewBox="0 0 16 16" focusable="false">' +
              '<circle cx="7" cy="7" r="4.5"></circle>' +
              '<path d="M10.5 10.5L14 14M7 4.8V9.2M4.8 7H9.2"></path>' +
            '</svg>';

          media.append(image, zoom);
          media.addEventListener('mouseenter', function () {
            preloadFullImage(bottle.image);
          }, { once: true });
          media.addEventListener('touchstart', function () {
            preloadFullImage(bottle.image);
          }, { once: true, passive: true });
          media.addEventListener('click', function (event) {
            event.preventDefault();
            event.stopPropagation();
            openBottleImage(
              bottle.image || image.src,
              image.currentSrc || image.src,
              image.alt,
              getBottleCaption(bottle)
            );
          });
        } else {
          media.textContent = volume + ' мл';
        }

        const copy = document.createElement('span');
        copy.className = 'dbp-option__copy';
        const name = document.createElement('span');
        name.className = 'dbp-option__name';
        name.textContent = bottle.title;
        const price = document.createElement('span');
        price.className = 'dbp-option__price';
        const nativeSurcharge = getNativeSurcharge(findNativeBottleOption(select, bottle));
        price.textContent = nativeSurcharge > 0
          ? '+ ' + nativeSurcharge.toLocaleString('ru-RU') + ' р.'
          : 'Без доплаты';
        copy.append(name, price);

        const check = document.createElement('span');
        check.className = 'dbp-option__check';
        check.textContent = '✓';
        button.append(media, copy, check);
        button.addEventListener('click', function () {
          setSelectedBottle(popup, picker, bottle);
        });
        categoryGrid.appendChild(button);
      });
    });

    const savedBottleId = getSavedBottleId(popup, volume);
    const currentCode = normalizeBottleValue(select.value);
    const savedBottle = availableOptions.find(function (item) { return item.id === savedBottleId; });
    const currentBottle = availableOptions.find(function (item) {
      return getBottleCode(item) === currentCode;
    });
    const initialBottle = savedBottle ||
      currentBottle ||
      availableOptions.find(function (item) { return item.isDefault; }) ||
      availableOptions[0];
    if (initialBottle) setSelectedBottle(popup, picker, initialBottle);

    /* Скрываем штатный select только после успешной сборки нашего интерфейса. */
    const nativeWrapper = findNativeBottleWrapper(popup);
    if (nativeWrapper) nativeWrapper.classList.add('dbp-picker__native-option');
  }

  function updatePicker(popup, picker) {
    const volume = getSelectedVolume(popup);
    const grid = picker.querySelector('.dbp-picker__grid');
    grid.innerHTML = '<div class="dbp-picker__status">Загружаем варианты…</div>';

    loadBottles().then(function (config) {
      if (!popup.isConnected || getSelectedVolume(popup) !== volume) return;
      const options = (config.volumes[volume] || []).slice().sort(function (a, b) {
        return (Number(a.order) || 0) - (Number(b.order) || 0);
      });
      if (!options.length) {
        grid.innerHTML = '<div class="dbp-picker__status is-error">Для выбранного объёма пока нет флаконов.</div>';
        return;
      }
      renderOptions(popup, picker, volume, options);
    }).catch(function (error) {
      console.error('Ошибка загрузки флаконов:', error);
      const nativeWrapper = findNativeBottleWrapper(popup);
      if (nativeWrapper) nativeWrapper.classList.remove('dbp-picker__native-option');
      grid.innerHTML = '<div class="dbp-picker__status is-error">Не удалось загрузить варианты флаконов.</div>';
    });
  }

  function mountPicker(popup) {
    if (!popup || popup.querySelector('.dbp-picker')) return;
    const info = popup.querySelector(INFO_SELECTOR);
    const volumeOption = popup.querySelector(VOLUME_OPTION_SELECTOR);
    if (!info || !volumeOption) return;

    const picker = document.createElement('section');
    picker.className = 'dbp-picker';
    picker.innerHTML =
      '<div class="dbp-picker__head">' +
        '<h4 class="dbp-picker__title">Выберите флакон</h4>' +
      '</div>' +
      '<div class="dbp-picker__grid"></div>';
    volumeOption.insertAdjacentElement('afterend', picker);
    syncCategoryColor(popup, picker);

    restoreSelectedVolume(popup);
    volumeOption.addEventListener('change', function () {
      /* Сначала даём Tilda закончить собственный пересчёт варианта и цены. */
      window.setTimeout(function () {
        if (popup.isConnected && picker.isConnected) updatePicker(popup, picker);
      }, 0);
    });
    updatePicker(popup, picker);
  }

  function getReadinessSignature(popup) {
    const info = popup.querySelector(INFO_SELECTOR);
    const volumeOption = popup.querySelector(VOLUME_OPTION_SELECTOR);
    const bottleSelect = getNativeBottleSelect(popup);
    const price = popup.querySelector(
      '.js-product-price, .js-store-prod-price-val, .t-store__prod-popup__price-value'
    );
    const addButton = popup.querySelector(
      '.t-store__prod-popup__btn, .js-store-prod-btn2, .js-product-button'
    );

    if (!info || !volumeOption || !bottleSelect || !price || !addButton) return '';
    if (!getSelectedVolume(popup) || bottleSelect.options.length < 1) return '';

    const optionCodes = Array.from(bottleSelect.options).map(function (option) {
      return normalizeBottleValue(option.value || option.textContent);
    }).join('|');
    return getSelectedVolume(popup) + ':' + optionCodes;
  }

  function tryMountPicker(popup) {
    if (!popup || !popup.isConnected || popup.querySelector('.dbp-picker')) return;

    const signature = getReadinessSignature(popup);
    if (!signature) {
      readiness.delete(popup);
      return;
    }

    const previous = readiness.get(popup);
    const state = previous && previous.signature === signature
      ? { signature: signature, matches: previous.matches + 1 }
      : { signature: signature, matches: 1 };
    readiness.set(popup, state);

    /* Монтируемся только после трёх одинаковых проверок полностью готовой карточки. */
    if (state.matches < READY_REQUIRED_MATCHES) return;
    readiness.delete(popup);
    mountPicker(popup);
  }

  function scan() {
    document.querySelectorAll(PRODUCT_SELECTOR).forEach(tryMountPicker);
  }

  function startPickerPolling() {
    if (!document.body) return;
    scan();
    window.setInterval(scan, READY_CHECK_INTERVAL);
  }

  function queuePickerStart() {
    /* Запуск после полной загрузки; первые проверки остаются только читающими. */
    window.setTimeout(startPickerPolling, 700);
  }

  /* В HEAD не читаем и не меняем карточку до полной загрузки страницы Tilda. */
  if (document.readyState !== 'complete') {
    window.addEventListener('load', queuePickerStart, { once: true });
  } else {
    queuePickerStart();
  }
})();
