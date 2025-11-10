import type { Almacen, ApiResponse } from './types';

const API_BASE = '/api';
const GET_WARE = `${API_BASE}/almacenes`;

export type Almacenes = ApiResponse<Almacen[]>;

export async function fetchWare(): Promise<Almacenes | null> {
    try {
        const res = await fetch(GET_WARE);
        if (!res.ok) {
            if (res.status === 404) {
                console.warn('No se encontraron almacenes');
                return null;
            }
            throw new Error("Error al cargar almacenes");
        }
        const data = await res.json() as Almacenes;
        return data;
    } catch (e) {
        console.error('Error al obtener los almacenes', e);
        throw new Error("Error al cargar los almacenes");       
    }
}
