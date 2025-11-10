<script lang="ts">
    import { onDestroy, onMount, tick } from 'svelte';
    import {
        addDays,
        addMonths,
        eachDayOfInterval,
        endOfMonth,
        endOfWeek,
        format,
        isSameMonth,
        isToday,
        startOfMonth,
        startOfWeek
    } from 'date-fns';
    import type { Locale } from 'date-fns';
    import { es as esLocale } from 'date-fns/locale';
    import * as tippyNS from 'tippy.js';
    import Swal from 'sweetalert2';
    import { fetchWare } from '$lib/functions/almacen';
    import { fetchItem } from '$lib/functions/articulos';
    import { fetchMark, fetchSub } from '$lib/functions/catalogos';
    import { fetchContAll } from '$lib/functions/conteos';
    import type {
        Almacen,
        Articulo,
        ConteoEvent,
        Marca,
        ProgramacionConteo,
        SubCategoria
    } from '$lib/functions/types';

    const tippy = (tippyNS as any).default ?? (tippyNS as any);

    type CalendarEvent = ConteoEvent & {
        sku?: string;
        marca?: string;
        subcategoria?: string;
        articuloId?: number | string | null;
        [key: string]: unknown;
    };

    type CatalogOption = {
        id: number | string;
        label: string;
        active?: boolean;
        [key: string]: unknown;
    };

    type CalendarCreationPayload = {
        date: Date;
        primaryId: number | string | null;
        secondaryId: number | string | null;
        descripcion: string;
        marcaId?: number | string | null;
        almacenId?: number | string | null;
        subgrupoId?: number | string | null;
        sku?: string | null;
        articuloId?: number | null;
    };

    type CatalogAdapter = {
        preloadPrimary?: () => Promise<CatalogOption[]>;
        searchPrimary?: (query: string) => Promise<CatalogOption[]>;
        fetchSecondary?: (primaryId: number | string) => Promise<CatalogOption[]>;
    };

    type CalendarCreationConfig = {
        enabled?: boolean;
        formTitle?: string;
        primaryLabel?: string;
        primaryPlaceholder?: string;
        secondaryLabel?: string;
        secondaryPlaceholder?: string;
        dateLabel?: string;
        descriptionLabel?: string;
        defaultDescription?: string;
        confirmationText?: string;
        cancelText?: string;
        successText?: string;
        searchMinChars?: number;
        emptyPrimaryMessage?: string;
        loadingSecondaryMessage?: string;
        blockedSecondaryMessage?: string;
        warehouseLabel?: string;
        warehousePlaceholder?: string;
        missingWarehouseMessage?: string;
        skuLabel?: string;
        skuPlaceholder?: string;
        skuHelperText?: string;
        skuSearchButton?: string;
        skuInfoEmptyText?: string;
    };

    type CalendarStatusToken = {
        order: number;
        dotClass: string;
        textClass: string;
        chipSolidHex: string;
        chipSoftHex: string;
    };

    type CalendarProps = {
        events?: CalendarEvent[];
        month?: number;
        year?: number;
        firstDayOfWeek?: 0 | 1;
        locale?: Locale;
        timezone?: string;
        statusStyles?: Partial<Record<string, Partial<CalendarStatusToken>>>;
        onNavigate?: (p: { year: number; month: number }) => void;
        onDayClick?: (p: { date: Date; events: CalendarEvent[] }) => void;
        onCreateEvent?: (payload: CalendarCreationPayload) => void;
        onCreateConteo?: (payload: CalendarCreationPayload) => void;
        creationConfig?: CalendarCreationConfig;
        catalogAdapter?: CatalogAdapter;
        primaryOptions?: CatalogOption[];
        secondaryOptions?: CatalogOption[];
        weekDayLabels?: string[];
    };

    type ResolvedCreationConfig = Required<CalendarCreationConfig>;

    const noop = () => {};

    const defaultStatusTokens: Record<string, CalendarStatusToken> = {
        Completado: {
            order: 3,
            dotClass: 'bg-emerald-500',
            textClass: 'text-white',
            chipSolidHex: '#10b981',
            chipSoftHex: 'rgba(16,185,129,0.12)'
        },
        Programado: {
            order: 2,
            dotClass: 'bg-amber-400',
            textClass: 'text-gray-900',
            chipSolidHex: '#f59e0b',
            chipSoftHex: 'rgba(245,158,11,0.14)'
        },
        Cancelado: {
            order: 1,
            dotClass: 'bg-rose-500',
            textClass: 'text-white',
            chipSolidHex: '#f43f5e',
            chipSoftHex: 'rgba(244,63,94,0.12)'
        }
    };

    const defaultCreationConfig: ResolvedCreationConfig = {
        enabled: true,
        formTitle: 'Programa nuevo conteo',
        primaryLabel: 'Marca',
        primaryPlaceholder: 'Escribe para buscar...',
        secondaryLabel: 'Subgrupo de articulos',
        secondaryPlaceholder: 'Seleccione un subgrupo',
        dateLabel: 'Fecha',
        descriptionLabel: 'Descripcion',
        defaultDescription: 'Conteo programado automaticamente',
        confirmationText: 'Guardar conteo',
        cancelText: 'Cerrar',
        successText: 'Conteo preparado',
        searchMinChars: 2,
        emptyPrimaryMessage: 'Sin resultados',
        loadingSecondaryMessage: 'Cargando subcategorias...',
        blockedSecondaryMessage: 'Seleccione una marca primero',
        warehouseLabel: 'Almacen',
        warehousePlaceholder: 'Seleccione un almacen',
        missingWarehouseMessage: 'Selecciona un almacen valido',
        skuLabel: 'SKU (opcional)',
        skuPlaceholder: 'Ingresa SKU para validar',
        skuHelperText: 'Busca un SKU para rellenar marca y subgrupo automaticamente',
        skuSearchButton: 'Buscar SKU',
        skuInfoEmptyText: 'Sin consulta de SKU'
    };

    const defaultAdapter: CatalogAdapter = {
        preloadPrimary: async () => {
            const res = await fetchMark('');
            return (res?.data ?? []).map(marcaToOption);
        },
        searchPrimary: async (query: string) => {
            const res = await fetchMark(query);
            return (res?.data ?? []).map(marcaToOption);
        },
        fetchSecondary: async (primaryId: number | string) => {
            const marcaId = Number(primaryId);
            if (!Number.isFinite(marcaId)) {
                return [];
            }
            const res = await fetchSub(marcaId);
            return (res?.data ?? []).map(subToOption);
        }
    };

    let {
        events = [] as CalendarEvent[],
        month = new Date().getMonth(),
        year = new Date().getFullYear(),
        firstDayOfWeek = 1 as 0 | 1,
        locale = esLocale,
        timezone = 'America/Mexico_City',
        statusStyles = {},
        onNavigate = noop,
        onDayClick = noop,
        onCreateEvent,
        onCreateConteo,
        creationConfig = {},
        catalogAdapter = defaultAdapter,
        primaryOptions = [] as CatalogOption[],
        secondaryOptions = [] as CatalogOption[],
        weekDayLabels = []
    }: CalendarProps = $props();

    let calendarLoading = $state(false);
    let calendarError = $state<string | null>(null);
    let almacenes: Almacen[] = [];
    let warehouseOptions: CatalogOption[] = [];
    let warehouseLookup = new Map<number, string>();
    let tooltipInstances: Array<{ destroy?: () => void }> = [];

    function marcaToOption(marca: Marca): CatalogOption {
        return {
            id: marca.id_marca,
            label: marca.nombre,
            active: marca.activo
        };
    }

    function subToOption(sub: SubCategoria): CatalogOption {
        return {
            id: sub.id_subcategoria,
            label: sub.nombre,
            active: sub.activo
        };
    }

    function almacenToOption(almacen: Almacen): CatalogOption {
        const sucursalName = almacen.Sucursal?.nombre ? `${almacen.Sucursal.nombre} · ` : '';
        return {
            id: almacen.id_almacen,
            label: `${sucursalName}${almacen.nombre}`,
            active: almacen.activo
        };
    }

    function buildWarehouseLookup(list: Almacen[] = []) {
        const map = new Map<number, string>();
        for (const almacen of list) {
            const option = almacenToOption(almacen);
            map.set(almacen.id_almacen, option.label);
            map.set(almacen.id_sucursal, option.label);
        }
        return map;
    }

    function conteoToEvent(conteo: ProgramacionConteo, lookup: Map<number, string>): CalendarEvent {
        const detalle = conteo.Detalle_Conteo?.[0];
        const ubicacion = detalle?.Ubicacion;
        const articulo = detalle?.Articulo;
        const sucursalKey = typeof ubicacion?.sucursal === 'number' ? ubicacion.sucursal : undefined;
        const almacenLabel =
            (sucursalKey !== undefined ? lookup.get(sucursalKey) : undefined) ??
            (articulo?.Departamento?.nombre ?? undefined) ??
            ubicacion?.zona ??
            null;
        const descripcion = conteo.descripcion ?? articulo?.descripcion ?? 'Conteo programado';
        return {
            id: conteo.id_programacion,
            date: conteo.fecha_programada ?? conteo.fecha_creacion,
            estado: conteo.estado,
            descripcion,
            almacen: almacenLabel ?? 'Sin ubicacion',
            sku: articulo?.sku,
            marca: articulo?.Marca?.nombre,
            subcategoria: articulo?.SubCategoria?.nombre,
            articuloId: articulo?.id_articulo ?? null
        };
    }

    async function collectConteos(firstPage?: Awaited<ReturnType<typeof fetchContAll>> | null) {
        const collected: ProgramacionConteo[] = [];
        const initial = firstPage ?? (await fetchContAll(1));
        if (initial?.data) {
            collected.push(...initial.data);
        }
        const totalPages = initial?.totalPaginas ?? 1;
        if (totalPages > 1) {
            for (let page = 2; page <= totalPages; page++) {
                const res = await fetchContAll(page);
                if (res?.data) {
                    collected.push(...res.data);
                }
            }
        }
        return collected;
    }

    async function bootstrapCalendarData() {
        calendarLoading = true;
        calendarError = null;
        try {
            const [wareRes, conteosPage] = await Promise.all([fetchWare(), fetchContAll(1)]);
            almacenes = wareRes?.data ?? [];
            warehouseOptions = almacenes.map(almacenToOption).filter((opt) => opt.active !== false);
            warehouseLookup = buildWarehouseLookup(almacenes);
            const conteos = await collectConteos(conteosPage);
            events = conteos.map((conteo) => conteoToEvent(conteo, warehouseLookup));
        } catch (error) {
            console.error('Error al cargar los datos del calendario', error);
            calendarError = 'No fue posible cargar los conteos programados';
            events = [];
        } finally {
            calendarLoading = false;
        }
    }

    async function preloadPrimaryCatalog() {
        try {
            if (!primaryOptions.length && catalogAdapter?.preloadPrimary) {
                primaryOptions = await catalogAdapter.preloadPrimary();
            }
        } catch (error) {
            console.error('Error cargando catalogos', error);
        }
    }

    async function initializeCalendar() {
        await Promise.all([preloadPrimaryCatalog(), bootstrapCalendarData()]);
        await tick();
        refreshDayTooltips();
    }

    function debounce<F extends (...args: any[]) => void>(fn: F, wait = 220) {
        let time: ReturnType<typeof setTimeout>;
        return (...args: Parameters<F>) => {
            clearTimeout(time);
            time = setTimeout(() => fn(...args), wait);
        }
    }

    function parseId(value?: string | null): number | string | null {
        if (!value?.length) return null;
        const numeric = Number(value);
        return Number.isNaN(numeric) ? value : numeric;
    }

    function buildWeekDays() {
        const reference = startOfWeek(new Date(), { weekStartsOn: firstDayOfWeek });
        return Array.from({ length: 7 }, (_, idx) => {
            const raw = format(addDays(reference, idx), 'EEE', { locale });
            const clean = raw.replace('.', '');
            return clean.charAt(0).toUpperCase() + clean.slice(1);
        });
    }

    function dayKey(d: Date) {
        return format(d, 'yyyy-MM-dd');
    }

    const normalizedCreation = $derived((): ResolvedCreationConfig => ({
        ...defaultCreationConfig,
        ...creationConfig
    }));

    const statusTokens = $derived((): Record<string, CalendarStatusToken> => {
        const merged: Record<string, CalendarStatusToken> = { ...defaultStatusTokens };
        if (statusStyles) {
            for (const [state, token] of Object.entries(statusStyles)) {
                if (!token) continue;
                const fallback = merged[state] ?? defaultStatusTokens.Programado;
                merged[state] = { ...fallback, ...token } as CalendarStatusToken;
            }
        }
        return merged;
    });

    const current = $derived(new Date(year, month, 1));
    const calStart = $derived(startOfWeek(startOfMonth(current), { weekStartsOn: firstDayOfWeek }));
    const calEnd = $derived(endOfWeek(endOfMonth(current), { weekStartsOn: firstDayOfWeek }));
    const days = $derived(eachDayOfInterval({ start: calStart, end: calEnd }));
    const weekDays = $derived(weekDayLabels?.length === 7 ? weekDayLabels : buildWeekDays());

    const eventMap = $derived(() => {
        const m = new Map<string, CalendarEvent[]>();
        for (const e of events) {
            const key = keyFromEvent(e);
            const arr = m.get(key);
            if (arr) arr.push(e);
            else m.set(key, [e]);
        }
        return m;
    });

    function emitCreation(payload: CalendarCreationPayload) {
        if (onCreateEvent) {
            onCreateEvent(payload);
            return;
        }
        onCreateConteo?.(payload);
    }

    function keyFromEvent(e: CalendarEvent) {
        const v = (e as any).date;
        if (typeof v === 'string') {
            const s = v.slice(0, 10);
            if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
        }
        const d = v instanceof Date ? v : new Date(v);
        return yyyyMmDdLocal(d);
    }

    function yyyyMmDdLocal(d: Date) {
        const y = d.getFullYear();
        const m = (d.getMonth() + 1).toString().padStart(2, '0');
        const day = d.getDate().toString().padStart(2, '0');
        return `${y}-${m}-${day}`;
    }

    function eventsFor(d: Date): CalendarEvent[] {
        return eventMap().get(dayKey(d)) ?? [];
    }

    function stateCountForDay(d: Date) {
        const counts: Record<string, number> = {};
        for (const ev of eventsFor(d)) {
            const k = ev.estado ?? 'Programado';
            counts[k] = (counts[k] ?? 0) + 1;
        }
        return Object.entries(counts)
            .filter(([state, c]) => c > 0 && state in statusTokens())
            .sort((a, b) => (statusTokens()[b[0]]?.order ?? 0) - (statusTokens()[a[0]]?.order ?? 0))
            .map(([estado, count]) => {
                const token = statusTokens()[estado] ?? statusTokens().Programado;
                return {
                    estado,
                    count,
                    dotClas: token.dotClass,
                    textClass: token.textClass
                };
            });
    }

    function estadoChip(estado?: string): string {
        const token = statusTokens()[estado ?? 'Programado'] ?? statusTokens().Programado;
        const label = estado ?? 'Programado';
        return `
            <span style="
                background:${token.chipSoftHex};
                color:${token.chipSolidHex};
                border:1px solid ${token.chipSolidHex}33;
                padding:2px 8px;
                border-radius:9999px;
                font-size:12px;">
                ${label}
            </span>
        `;
    }

    function countBadge(label: string, n: number): string {
        return `
            <span style="display:inline-flex;align-items:center;gap:8px;
                border:1px solid #e5e7eb;border-radius:9999px;
                padding:4px 10px;font-size:12px;">
                <strong>${label}:</strong> ${n}
            </span>`;
    }

    function renderDay(items: CalendarEvent[]): string {
        if (!items.length){
            return `<div style="color:#4b5563">Sin registros para este dia</div>`;
        }

        const total = items.length;
        const completados = items.filter(i => i.estado === 'Completado').length;
        const cancelados = items.filter(i => i.estado === 'Cancelado').length;
        const programados = total - completados - cancelados;

        const resumen = `
            <div style="display:flex; flex-wrap:wrap;gap:8px;margin-bottom:12px">
                ${countBadge('Total', total)}
                ${countBadge('Completados', completados)}
                ${countBadge('Cancelados', cancelados)}
                ${countBadge('Programados', programados)}
            </div>
        `;

        const rows = items.map((ev, idx) => {
            const chip = estadoChip(ev.estado);
            const alm = ev.almacen ? `<strong>${ev.almacen}</strong>` : '-';
            const desc = ev.descripcion ?? 'Sin descripcion';
            const id = (ev as any).id_programacion ?? ev.id ?? null;
            const idHtml = id ? `<div style="font-size:12px;color:#6b7280">ID: ${id}</div>` : '';
            const marcaHtml = ev.marca ? `<div style="font-size:12px;color:#6b7280">Marca: ${ev.marca}</div>` : '';
            const subHtml = ev.subcategoria ? `<div style="font-size:12px;color:#6b7280">Subgrupo: ${ev.subcategoria}</div>` : '';
            const skuEncoded = ev.sku ? encodeURIComponent(ev.sku) : null;
            const skuKey = skuEncoded ? `${skuEncoded}-${idx}` : null;
            const skuLabel = ev.sku ? `<div style="font-size:12px;color:#6b7280">SKU: ${ev.sku}</div>` : '';
            const skuButton = skuKey
                ? `<button type="button"
                        data-sku-detail="${skuKey}"
                        data-sku-value="${skuEncoded}"
                        style="margin-top:6px;padding:4px 10px;border-radius:9999px;border:1px solid #dbeafe;background:#eff6ff;font-size:12px;color:#1d4ed8;cursor:pointer;">
                        Ver articulo
                    </button>`
                : '';
            const skuDetail = skuKey
                ? `<div data-sku-info="${skuKey}" style="display:none;margin-top:6px;padding:8px 10px;border:1px dashed #e5e7eb;border-radius:8px;"></div>`
                : '';

             return `
            <tr>
                <td style="padding:8px 10px;border-top:1px solid #e5e7eb;white-space:nowrap;vertical-align:top">${chip}</td>
                <td style="padding:8px 10px;border-top:1px solid #e5e7eb;vertical-align:top">${alm}${idHtml}</td>
                <td style="padding:8px 10px;border-top:1px solid #e5e7eb;vertical-align:top;color:#374151">
                    ${desc}
                    ${marcaHtml}
                    ${subHtml}
                    ${skuLabel}
                    ${skuButton}
                    ${skuDetail}
                </td>
            </tr>
            `;
        }).join('');
        
        const tabla = `
            <div style="max-height:50vh;overflow:auto;border:1px solid #e5e7eb;border-radius:10px">
                <table>
                    <thead>
                        <tr>
                            <th style="text-align:left;padding:10px 10px;font-weight:600">Estado</th>
                            <th style="text-align:left;padding:10px 10px;font-weight:600">Almacen</th>
                            <th style="text-align:left;padding:10px 10px;font-weight:600">Descripcion</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${rows}
                    </tbody>
                </table>
            </div>
        `;

        return resumen + tabla;
    }

    function refreshDayTooltips() {
        destroyDayTooltips();
        for (const el of dayRefs) {
            if (!el) continue;
            const raw = el.getAttribute('data-events');
            if (!raw) continue;
            let arr: CalendarEvent[] = [];
            try {
                arr = JSON.parse(raw);
            } catch {
                continue;
            }
            if (!arr.length) continue;
            const content = arr.map(ev => `
                <div class="space-y-0.5">
                    <div><strong>${ev.estado ?? 'Programado'}</strong></div>
                    ${ev.descripcion ? `<div>${ev.descripcion}</div>` : ''}
                </div>
            `).join('');
            const instance = tippy(el, { allowHTML: true, content, placement: 'top', theme: 'light-border', delay: [100, 0] });
            tooltipInstances.push(instance);
        }
    }

    function destroyDayTooltips() {
        for (const instance of tooltipInstances) {
            try {
                instance?.destroy?.();
            } catch {
            }
        }
        tooltipInstances = [];
    }

    function renderArticuloInfo(articulo: Articulo) {
        const marca = articulo.Marca?.nombre ?? 'Sin marca';
        const departamento = articulo.Departamento?.nombre ?? 'Sin departamento';
        const subcategoria = articulo.SubCategoria?.nombre ?? 'Sin subcategoria';
        return `
            <div style="display:flex;flex-direction:column;gap:4px;font-size:12px;color:#374151">
                <div><strong>${articulo.descripcion ?? 'Sin descripcion'}</strong></div>
                <div><span style="color:#6b7280">Marca:</span> ${marca}</div>
                <div><span style="color:#6b7280">Departamento:</span> ${departamento}</div>
                <div><span style="color:#6b7280">Subcategoria:</span> ${subcategoria}</div>
            </div>
        `;
    }

    function optionsHtml(items: CatalogOption[], placeholder: string): string {
        const first = `<option value="">${placeholder}</option>`;
        const body = items
            .filter((s) => s.active !== false)
            .map((s) => `<option value="${s.id}">${s.label}</option>`)
            .join('');
        return first + body;
    }

    function fillSecondarySelect(el: HTMLSelectElement, items: CatalogOption[], placeholder: string) {
        el.innerHTML = optionsHtml(items, placeholder);
    }

    function formHtml(d: Date, cfg: ResolvedCreationConfig) {
        const fechaISO = yyyyMmDdLocal(d);
        return `
        <div style="display:flex;flex-direction:column;gap:10px;margin-top:12px">
            <div style="font-weight:600;color:#374151">${cfg.formTitle}</div>

            <label style="display:flex;flex-direction:column;gap:6px">
                <span style="font-size:12px;color:#6b7280">${cfg.primaryLabel}</span>
                <div style="position:relative">
                    <input id="swal-primary-input" type="text" class="swal2-input" style="margin:0" placeholder="${cfg.primaryPlaceholder}" autocomplete="off" />
                    <input id="swal-primary-id" type="hidden" />
                    <div id="swal-primary-menu" role="listbox"
                        style="display:none;position:absolute;left:0;right:0;top:100%;max-height:240px;overflow:auto;background:#fff;border:1px solid #e5e7eb;border-radius:8px;margin-top:4px;box-shadow:0 4px 12px rgba(0,0,0,.08);">
                    </div>
                </div>
            </label>

            <label style="display:flex;flex-direction:column;gap:6px">
                <span style="font-size:12px;color:#6b7280">${cfg.secondaryLabel}</span>
                <select id="swal-secondary" class="swal2-input" style="margin:0" disabled>
                    ${optionsHtml(secondaryOptions, cfg.secondaryPlaceholder)}
                </select>
            </label>

            <label style="display:flex;flex-direction:column;gap:6px">
                <span style="font-size:12px;color:#6b7280">${cfg.warehouseLabel}</span>
                <select id="swal-almacen" class="swal2-input" style="margin:0" ${warehouseOptions.length ? '' : 'disabled'}>
                    ${optionsHtml(warehouseOptions, cfg.warehousePlaceholder)}
                </select>
                ${warehouseOptions.length ? '' : `<small style="color:#6b7280">Cargando almacenes...</small>`}
            </label>

            <label style="display:flex;flex-direction:column;gap:6px">
                <span style="font-size:12px;color:#6b7280">${cfg.skuLabel}</span>
                <div style="display:flex;gap:8px;align-items:stretch">
                    <input id="swal-sku" type="text" class="swal2-input" style="margin:0" placeholder="${cfg.skuPlaceholder}" autocomplete="off" />
                    <button type="button" id="swal-sku-search"
                        class="swal2-styled"
                        style="min-width:120px;margin:0;background:#2563eb">
                        ${cfg.skuSearchButton}
                    </button>
                </div>
                <small style="color:#6b7280">${cfg.skuHelperText}</small>
                <div id="swal-sku-info" style="border:1px dashed #e5e7eb;border-radius:8px;padding:8px 10px;font-size:12px;color:#4b5563">
                    ${cfg.skuInfoEmptyText}
                </div>
            </label>

            <div style="display:grid;grid-template-columns:1fr 1fr; gap:10px">
                <label style="display:flex;flex-direction:column;gap:6px">
                    <span style="font-size:12px;color:#6b7280">${cfg.dateLabel}</span>
                    <input id="swal-fecha" type="date" class="swal2-input" value="${fechaISO}" style="margin:0" readonly/>
                </label>

                <label style="display:flex;flex-direction:column;gap:6px">
                    <span style="font-size:12px;color:#6b7280">${cfg.descriptionLabel}</span>
                    <input id="swal-desc" type="text" class="swal2-input" value="${cfg.defaultDescription}" style="margin:0" />
                </label>
            </div>
        </div>
        `;
    }

    function prevMonth() {
        const d = addMonths(current, -1);
        year = d.getFullYear();
        month = d.getMonth();
        onNavigate({year, month});
    }

    function nextMonth() {
        const d = addMonths(current, +1);
        year = d.getFullYear();
        month = d.getMonth();
        onNavigate({year, month});
    }

    let dayRefs: Array<HTMLElement | null> = [];

    onMount(() => {
        void initializeCalendar();
    });

    onDestroy(() => {
        destroyDayTooltips();
    });

    function handleDayClick(d: Date) {
        const dayEvents = eventsFor(d);
        const cfg = normalizedCreation();
        const creationEnabled = cfg.enabled !== false;

        function attachEventSkuDetailHandlers() {
            const popup = Swal.getPopup();
            if (!popup) return;
            const buttons = popup.querySelectorAll<HTMLButtonElement>('[data-sku-detail]');
            buttons.forEach((btn) => {
                btn.addEventListener('click', () => {
                    void loadEventSkuDetail(btn);
                });
            });
        }

        async function loadEventSkuDetail(btn: HTMLButtonElement) {
            const key = btn.getAttribute('data-sku-detail');
            const skuEncoded = btn.getAttribute('data-sku-value');
            if (!key || !skuEncoded) return;
            const popup = Swal.getPopup();
            if (!popup) return;
            const container = popup.querySelector<HTMLElement>(`[data-sku-info="${key}"]`);
            if (!container) return;
            if (container.dataset.loaded === 'true') {
                container.style.display = container.style.display === 'none' ? 'block' : 'none';
                return;
            }
            const sku = decodeURIComponent(skuEncoded);
            btn.disabled = true;
            container.style.display = 'block';
            container.innerHTML = `<div style="font-size:12px;color:#4b5563">Consultando SKU ${sku}...</div>`;
            try {
                const response = await fetchItem(sku);
                const articulo = response?.data ?? null;
                container.innerHTML = articulo
                    ? renderArticuloInfo(articulo)
                    : `<div style="font-size:12px;color:#6b7280">No se encontro informacion para ${sku}</div>`;
                if (articulo) {
                    container.dataset.loaded = 'true';
                }
            } catch (error) {
                console.error('Error consultando SKU del evento', error);
                container.innerHTML = `<div style="font-size:12px;color:#b91c1c">Error al consultar SKU ${sku}</div>`;
            } finally {
                btn.disabled = false;
            }
        }

        const htmlBody = `
            ${renderDay(dayEvents)}
            ${creationEnabled ? formHtml(d, cfg) : ''}
        `;
        void Swal.fire({
            title: format(d, "EEEE d 'de' MMMM yyyy", { locale }),
            html: htmlBody,
            focusConfirm: false,
            showCancelButton: creationEnabled,
            showConfirmButton: true,
            confirmButtonText: creationEnabled ? cfg.confirmationText : cfg.cancelText,
            cancelButtonText: cfg.cancelText,
            width: 750,
            customClass: {
                popup: 'rounded-2xl',
                title: 'title-left',
                confirmButton: 'swal2-confirm',
            },
            didOpen: () => {
                attachEventSkuDetailHandlers();
                if (!creationEnabled) return;
                const primaryInput0 = document.getElementById('swal-primary-input') as HTMLInputElement | null;
                const primaryIdHidden0 = document.getElementById('swal-primary-id') as HTMLInputElement | null;
                const menu0 = document.getElementById('swal-primary-menu') as HTMLDivElement | null;
                const secondarySelect0 = document.getElementById('swal-secondary') as HTMLSelectElement | null;
                const warehouseSelect0 = document.getElementById('swal-almacen') as HTMLSelectElement | null;
                const skuInput0 = document.getElementById('swal-sku') as HTMLInputElement | null;
                const skuButton0 = document.getElementById('swal-sku-search') as HTMLButtonElement | null;
                const skuInfo0 = document.getElementById('swal-sku-info') as HTMLDivElement | null;

                if (!primaryInput0 || !primaryIdHidden0 || !menu0 || !secondarySelect0 || !warehouseSelect0 || !skuInput0 || !skuButton0 || !skuInfo0) return;

                const primaryInput = primaryInput0;
                const primaryIdHidden = primaryIdHidden0;
                const menu = menu0;
                const secondarySelect = secondarySelect0;
                const warehouseSelect = warehouseSelect0;
                const skuInput = skuInput0;
                const skuButton = skuButton0;
                const skuInfo = skuInfo0;

                secondarySelect.disabled = true;
                secondarySelect.innerHTML = `<option value="">${cfg.blockedSecondaryMessage}</option>`;

                let results: CatalogOption[] = [];
                let activeIndex = -1;

                function hideMenu() { menu.style.display = 'none'; }
                function showMenu() { menu.style.display = 'block'; }

                function renderMenu(showError = false) {
                    if (showError) {
                        menu.innerHTML = `<div style="padding:10px;color:#b91c1c">Error al buscar opciones</div>`;
                        showMenu();
                        return;
                    }
                    if (!results.length) {
                        menu.innerHTML = `<div style="padding:10px;color:#6b7280">${cfg.emptyPrimaryMessage}</div>`;
                        showMenu();
                        return;
                    }
                    menu.innerHTML = results.map((m, i) => `
                        <div data-index="${i}" role="option"
                            style="padding:8px 12px;cursor:pointer;${i === activeIndex ? 'background:#f3f4f6' : ''}">
                            ${m.label}
                        </div>
                    `).join('');
                    showMenu();
                }

                async function selectPrimary(option: CatalogOption) {
                    primaryIdHidden.value = String(option.id);
                    primaryInput.value = option.label;
                    hideMenu();

                    secondarySelect.disabled = true;
                    secondarySelect.innerHTML = `<option value="">${cfg.loadingSecondaryMessage}</option>`;
                    try {
                        if (catalogAdapter?.fetchSecondary) {
                            const fetched = await catalogAdapter.fetchSecondary(option.id);
                            secondaryOptions = fetched;
                        }
                        fillSecondarySelect(secondarySelect, secondaryOptions, cfg.secondaryPlaceholder);
                        secondarySelect.disabled = false;
                    } catch (error) {
                        console.error('Error al cargar opciones secundarias', error);
                        secondarySelect.innerHTML = `<option value="">${cfg.blockedSecondaryMessage}</option>`;
                        secondarySelect.disabled = true;
                    }
                }

                async function hydrateSelectionFromArticulo(articulo: Articulo) {
                    if (!articulo.id_marca) return;
                    const option: CatalogOption = {
                        id: articulo.id_marca,
                        label: articulo.Marca?.nombre ?? `Marca ${articulo.id_marca}`
                    };
                    await selectPrimary(option);
                    if (articulo.id_subcategoria && secondarySelect) {
                        secondarySelect.value = String(articulo.id_subcategoria);
                    }
                }

                function setSkuInfo(html: string) {
                    skuInfo.innerHTML = html;
                }

                async function handleSkuSearch() {
                    const sku = skuInput.value.trim();
                    if (!sku.length) {
                        skuInput.dataset.skuId = '';
                        setSkuInfo('<div style="color:#6b7280">Ingresa un SKU para buscar</div>');
                        return;
                    }
                    skuButton.disabled = true;
                    setSkuInfo(`<div style="color:#4b5563">Buscando SKU ${sku}...</div>`);
                    try {
                        const response = await fetchItem(sku);
                        const articulo = response?.data ?? null;
                        if (!articulo) {
                            skuInput.dataset.skuId = '';
                            setSkuInfo(`<div style="color:#6b7280">No se encontro informacion para ${sku}</div>`);
                            return;
                        }
                        skuInput.dataset.skuId = String(articulo.id_articulo);
                        setSkuInfo(renderArticuloInfo(articulo));
                        await hydrateSelectionFromArticulo(articulo);
                    } catch (error) {
                        console.error('Error al buscar SKU', error);
                        skuInput.dataset.skuId = '';
                        setSkuInfo('<div style="color:#b91c1c">No fue posible buscar el SKU</div>');
                    } finally {
                        skuButton.disabled = false;
                    }
                }

                const doSearch = debounce(async (query: string) => {
                    primaryIdHidden.value = '';
                    if (!query || query.trim().length < cfg.searchMinChars) {
                        results = [];
                        activeIndex = -1;
                        hideMenu();
                        secondarySelect.disabled = true;
                        secondarySelect.innerHTML = `<option value="">${cfg.blockedSecondaryMessage}</option>`;
                        return;
                    }
                    try {
                        if (catalogAdapter?.searchPrimary) {
                            results = (await catalogAdapter.searchPrimary(query.trim())).filter(m => m.active !== false);
                        } else {
                            const base = primaryOptions ?? [];
                            const term = query.trim().toLowerCase();
                            results = base.filter(opt => opt.label.toLowerCase().includes(term) && opt.active !== false);
                        }
                        activeIndex = results.length ? 0 : -1;
                        renderMenu();
                    } catch (err) {
                        console.error('Error buscando opciones primarias', err);
                        results = [];
                        activeIndex = -1;
                        renderMenu(true);
                    }
                }, 220);

                primaryInput.addEventListener('input', (e) => {
                    const q = (e.target as HTMLInputElement).value;
                    doSearch(q);
                });

                primaryInput.addEventListener('keydown', (e) => {
                    if (!['ArrowDown','ArrowUp','Enter','Escape'].includes(e.key)) return;
                    if (e.key === 'Escape') {
                        hideMenu();
                        return;
                    }
                    if (!results.length) return;
                    if (e.key === 'ArrowDown') {
                        e.preventDefault();
                        activeIndex = (activeIndex + 1) % results.length;
                        renderMenu();
                    } else if (e.key === 'ArrowUp') {
                        e.preventDefault();
                        activeIndex = (activeIndex - 1 + results.length) % results.length;
                        renderMenu();
                    } else if (e.key === 'Enter') {
                        e.preventDefault();
                        if (activeIndex >= 0) {
                            void selectPrimary(results[activeIndex]);
                        }
                    }
                });

                menu.addEventListener('mousedown', (ev) => {
                    const item = (ev.target as HTMLElement).closest('[data-index]') as HTMLElement | null;
                    if (!item) return;
                    const idx = Number(item.getAttribute('data-index') ?? '-1');
                    if (idx >= 0 && idx < results.length) {
                        void selectPrimary(results[idx]);
                    }
                });

                primaryInput.addEventListener('blur', () => {
                    setTimeout(() => hideMenu(), 150);
                });

                primaryInput.addEventListener('focus', () => {
                    if (primaryInput.value.trim().length >= cfg.searchMinChars && results.length) {
                        renderMenu();
                    }
                });

                skuButton.addEventListener('click', () => {
                    void handleSkuSearch();
                });
                skuInput.addEventListener('keydown', (event) => {
                    if (event.key === 'Enter') {
                        event.preventDefault();
                        void handleSkuSearch();
                    }
                });
                skuInput.addEventListener('input', () => {
                    skuInput.dataset.skuId = '';
                });
            },
            preConfirm: creationEnabled
                ? () => {
                    const primaryIdHidden = document.getElementById('swal-primary-id') as HTMLInputElement | null;
                    const secondarySelect = document.getElementById('swal-secondary') as HTMLSelectElement | null;
                    const warehouseSelect = document.getElementById('swal-almacen') as HTMLSelectElement | null;
                    const fechaInput = document.getElementById('swal-fecha') as HTMLInputElement | null;
                    const descInput = document.getElementById('swal-desc') as HTMLInputElement | null;
                    const skuInput = document.getElementById('swal-sku') as HTMLInputElement | null;

                    const primaryId = parseId(primaryIdHidden?.value ?? null);
                    const secondaryId = parseId(secondarySelect?.value ?? null);
                    const almacenId = parseId(warehouseSelect?.value ?? null);
                    const fechaStr = fechaInput?.value ?? '';
                    const descripcion = descInput?.value ?? '';
                    const skuValue = skuInput?.value.trim() ?? '';
                    const articuloId = skuInput?.dataset.skuId ? Number(skuInput.dataset.skuId) : null;

                    if (!primaryId) {
                        Swal.showValidationMessage(`Selecciona ${cfg.primaryLabel?.toLowerCase() ?? 'una opcion'}`);
                        return;
                    }
                    if (!secondaryId) {
                        Swal.showValidationMessage(`Selecciona ${cfg.secondaryLabel?.toLowerCase() ?? 'una opcion'}`);
                        return;
                    }
                    if (!almacenId) {
                        Swal.showValidationMessage(cfg.missingWarehouseMessage ?? 'Selecciona un almacen');
                        return;
                    }
                    if (!fechaStr) {
                        Swal.showValidationMessage('La fecha es requerida');
                        return;
                    }

                    const [yy, mm, dd] = fechaStr.split('-').map(Number);
                    const date = new Date(yy, (mm ?? 1) - 1, dd);

                    const payload: CalendarCreationPayload = {
                        date,
                        primaryId,
                        secondaryId,
                        descripcion,
                        marcaId: primaryId,
                        almacenId,
                        subgrupoId: secondaryId,
                        sku: skuValue.length ? skuValue : null,
                        articuloId: typeof articuloId === 'number' && Number.isFinite(articuloId) ? articuloId : null
                    };

                    return payload;
                }
                : undefined
        }).then((res) => {
            onDayClick({ date: d, events: dayEvents });

            if (creationEnabled && res.isConfirmed && res.value) {
                emitCreation(res.value as CalendarCreationPayload);
                Swal.fire({
                    icon: 'success',
                    title: cfg.successText,
                    timer: 1600,
                    showConfirmButton: false
                });
            }
        });
    }
</script>

<div class="rounded-2xl border border-gray-100 bg-white/95 p-4 text-gray-900 shadow-lg shadow-black/5 sm:p-6">
    {#if calendarLoading}
        <div class="mb-4 rounded-xl bg-blue-50 px-3 py-2 text-sm text-blue-700">Cargando conteos y almacenes...</div>
    {/if}
    {#if calendarError}
        <div class="mb-4 rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-700">{calendarError}</div>
    {/if}
    <div class="mb-4 grid grid-cols-[auto_1fr_auto] items-center gap-3">
        <button
            class="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-gray-200 bg-blue-50 text-blue-600 transition hover:bg-blue-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
            aria-label="Mes anterior"
            onclick={prevMonth}>
            <span aria-hidden="true">&lsaquo;</span>
        </button>

        <div class="text-center text-lg font-bold uppercase tracking-wide text-gray-700 sm:text-xl md:text-2xl">
            {format(current, 'MMMM yyyy', { locale })}
        </div>

        <button
            class="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-gray-200 bg-blue-50 text-blue-600 transition hover:bg-blue-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
            aria-label="Mes siguiente"
            onclick={nextMonth}>
            <span aria-hidden="true">&rsaquo;</span>
        </button>
    </div>

    <div class="mb-3 grid grid-cols-7 px-1 text-[11px] font-semibold uppercase tracking-wide text-gray-500 sm:text-xs md:text-sm">
        {#each weekDays as wd}
            <div class="text-center">{wd}</div>
        {/each}
    </div>

    <div role="grid" aria-label="Calendario mensual" class="grid grid-cols-7 gap-1 sm:gap-1.5 md:gap-2">
        {#each days as d, i}
            {@const dayEvents = eventsFor(d)}
            <button
                bind:this={dayRefs[i]}
                role="gridcell"
                aria-label={`${format(d, 'EEEE d', { locale })}${dayEvents.length ? `, ${dayEvents.length} evento(s)` : ''}`}
                data-events={dayEvents.length ? JSON.stringify(dayEvents) : null}
                onclick={() => handleDayClick(d)}
                class={`relative grid aspect-square place-items-center rounded-2xl border p-2 text-center text-sm font-semibold transition duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 focus-visible:ring-offset-white
                    ${isSameMonth(d, current)
                        ? 'border-gray-200 bg-gradient-to-br from-white to-gray-50 text-gray-900'
                        : 'border-gray-100 bg-gray-50 text-gray-400'}
                    ${isToday(d) ? 'ring-2 ring-blue-500 ring-offset-2 ring-offset-white' : ''}
                    hover:-translate-y-0.5 hover:shadow-md`}
                >
                <span class="z-0 text-xl font-bold text-gray-700 sm:text-2xl md:text-4xl">{format(d, 'd')}</span>

                {#if dayEvents.length}
                    {@const dots = stateCountForDay(d)}
                    <div class="pointer-events-none absolute inset-x-1 bottom-1 z-10 flex justify-center">
                        <div class="flex flex-row items-center gap-1 sm:gap-1.5">
                            {#each dots as ev}
                                <span
                                    class={`relative h-4 w-4 rounded-full opacity-80 sm:h-5 sm:w-5 md:h-6 md:w-6 ${ev.dotClas}`}
                                    title={`${ev.estado}: ${ev.count}`}
                                >
                                    {#if ev.count > 1}
                                        <span class={`text-[9px] font-semibold leading-none sm:text-[10px] md:text-lg ${ev.textClass}`}>
                                            {ev.count}
                                        </span>
                                    {/if}
                                </span>
                            {/each}
                        </div>
                    </div>
                {/if}
            </button>
        {/each}
    </div>

    <div class="mt-4 flex flex-wrap items-center gap-3 text-xs font-semibold text-gray-600 sm:text-sm">
        <span class="inline-flex items-center gap-2 rounded-full border border-gray-200 bg-gray-50 px-3 py-1">
            <span class="h-3 w-3 rounded-full bg-amber-400 sm:h-4 sm:w-4"></span> Programado
        </span>
        <span class="inline-flex items-center gap-2 rounded-full border border-gray-200 bg-gray-50 px-3 py-1">
            <span class="h-3 w-3 rounded-full bg-emerald-500 sm:h-4 sm:w-4"></span> Completado
        </span>
        <span class="inline-flex items-center gap-2 rounded-full border border-gray-200 bg-gray-50 px-3 py-1">
            <span class="h-3 w-3 rounded-full bg-rose-500 sm:h-4 sm:w-4"></span> Cancelado
        </span>
    </div>
</div>
