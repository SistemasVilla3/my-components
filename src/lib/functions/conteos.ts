import type { PaginatedResponse, ProgramacionConteo } from './types';

const API_INVENTARIO = '/api/inventario';
const GET_CON_PEN = `${API_INVENTARIO}/conteos-pendientes`;
const GET_CON_FIN = `${API_INVENTARIO}/conteos-finalizados`;
const GET_CON_ALL = `${API_INVENTARIO}/conteos-todos`;

type ConteosData = ProgramacionConteo[] | null;

export type Conteo = ProgramacionConteo;

export type ConteosPendientes = PaginatedResponse<ConteosData>;

export type ConteosFinalizados = PaginatedResponse<ConteosData>;

export type AllConteos = PaginatedResponse<ConteosData>;

export async function fetchContPend(pagina: number): Promise<ConteosPendientes | null> {
    try {
        const res = await fetch(`${GET_CON_PEN}?limit=5&page=${pagina}`);
        if (!res.ok) {
            if (res.status === 404) {
                console.warn('No se encontraron conteos pendientes');
                return null;
            }
            throw new Error("Error al cargar los conteos pendientes");
        }
        const data = await res.json() as ConteosPendientes;
        return data;
    } catch (e) {
        console.error('Error al obtener los conteos pendientes', e);
        throw new Error("Error al cargar los conteos pendientes");       
    }
}

export async function fetchContFin(pagina: number): Promise<ConteosFinalizados | null> {
    try {
        const res = await fetch(`${GET_CON_FIN}?limit=5&page=${pagina}`);
        if (!res.ok) {
            if (res.status === 404) {
                console.warn('No se encontraron conteos finalizados');
                return null;
            }
            throw new Error("Error al cargar los conteos finalizados");
        }
        const data = await res.json() as ConteosFinalizados;
        return data;
    } catch (e) {
        console.error('Error al obtener los conteos finalizados', e);
        throw new Error("Error al cargar los conteos finalizados");;
    }
}

export async function fetchContAll(pagina: number): Promise<AllConteos | null> {
    try {
        const res = await fetch(`${GET_CON_ALL}?limit=5&page=${pagina}`);
        if (!res.ok) {
            if (res.status === 404) {
                console.warn('No se encontraron conteos finalizados');
                return null;
            }
            throw new Error("Error al cargar los conteos finalizados");
        }
        const data = await res.json() as AllConteos;
        return data;
    } catch (e) {
        console.error('Error al obtener los conteos finalizados', e);
        throw new Error("Error al cargar los conteos finalizados");;
    }
}
