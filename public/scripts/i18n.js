import { registerDebugFunction } from './power-user.js';
import { waitUntilCondition } from './utils.js';

const storageKey = 'language';
const overrideLanguage = localStorage.getItem('language');

const localeFile = overrideLanguage || navigator.userLanguage || 'lang';
export const localeData = await fetch(`./locales/${localeFile}.json`).then(response => {
    console.log(`Loading locale data from ./locales/${localeFile}.json`);
    if (!response.ok) {
        throw new Error(`Failed to load locale data: ${response.status} ${response.statusText}`);
    }
    return response.json();
});

function getMissingTranslations() {
    const missingData = [];

    for (const language of localeData) {
        $(document).find('[data-i18n]').each(function () {
            const keys = $(this).data('i18n').split(';'); // Multi-key entries are ; delimited
            for (const key of keys) {
                const attributeMatch = key.match(/\[(\S+)\](.+)/); // [attribute]key
                if (attributeMatch) { // attribute-tagged key
                    const localizedValue = localeData?.[attributeMatch[2]];
                    if (!localizedValue) {
                        missingData.push({ key, language, value: $(this).attr(attributeMatch[1]) });
                    }
                } else { // No attribute tag, treat as 'text'
                    const localizedValue = localeData?.[key];
                    if (!localizedValue) {
                        missingData.push({ key, language, value: $(this).text().trim() });
                    }
                }
            }
        });
    }

    // Remove duplicates
    const uniqueMissingData = [];
    for (const { key, language, value } of missingData) {
        if (!uniqueMissingData.some(x => x.key === key && x.language === language && x.value === value)) {
            uniqueMissingData.push({ key, language, value });
        }
    }

    // Sort by language, then key
    uniqueMissingData.sort((a, b) => a.language.localeCompare(b.language) || a.key.localeCompare(b.key));

    // Map to { language: { key: value } }
    let missingDataMap = {};
    for (const { key, value } of uniqueMissingData) {
        if (!missingDataMap) {
            missingDataMap = {};
        }
        missingDataMap[key] = value;
    }

    console.table(uniqueMissingData);
    console.log(missingDataMap);

    toastr.success(`Found ${uniqueMissingData.length} missing translations. See browser console for details.`);
}

export function applyLocale(root = document) {
    const $root = root instanceof Document ? $(root) : $(new DOMParser().parseFromString(root, 'text/html'));

    //find all the elements with `data-i18n` attribute
    $root.find('[data-i18n]').each(function () {
        //read the translation from the language data
        const keys = $(this).data('i18n').split(';'); // Multi-key entries are ; delimited
        for (const key of keys) {
            const attributeMatch = key.match(/\[(\S+)\](.+)/); // [attribute]key
            if (attributeMatch) { // attribute-tagged key
                const localizedValue = localeData?.[attributeMatch[2]];
                if (localizedValue) {
                    $(this).attr(attributeMatch[1], localizedValue);
                }
            } else { // No attribute tag, treat as 'text'
                const localizedValue = localeData?.[key];
                if (localizedValue) {
                    $(this).text(localizedValue);
                }
            }
        }
    });

    if (root !== document) {
        return $root.get(0).body.innerHTML;
    }
}

async function addLanguagesToDropdown() {
    const langs = await fetch('/locales/lang.json').then(response => response.json());
    console.log(langs);

    for (const lang of langs) {
        const option = document.createElement('option');
        option.value = lang;
        option.innerText = lang;
        $('#ui_language_select').append(option);
    }

    const selectedLanguage = localStorage.getItem(storageKey);
    if (selectedLanguage) {
        $('#ui_language_select').val(selectedLanguage);
    }
}

export function initLocales() {
    waitUntilCondition(() => !!localeData);
    applyLocale();
    addLanguagesToDropdown();

    $('#ui_language_select').on('change', async function () {
        const language = String($(this).val());

        if (language) {
            localStorage.setItem(storageKey, language);
        } else {
            localStorage.removeItem(storageKey);
        }

        location.reload();
    });

    registerDebugFunction('getMissingTranslations', 'Get missing translations', 'Detects missing localization data and dumps the data into the browser console.', getMissingTranslations);
    registerDebugFunction('applyLocale', 'Apply locale', 'Reapplies the currently selected locale to the page.', applyLocale);
}
