import type { ApiResponse, Marca, SubCategoria } from './types';

const GET_MARK = '/api/catalogos/marcas';

export type Marcas = ApiResponse<Marca[]>;

export type Subcategorias = ApiResponse<SubCategoria[]>;

export async function fetchMark(q: string): Promise<Marcas | null> {
    try {
        const res = await fetch(`${GET_MARK}/buscar?q=${q}&limit=10&page=1`);
        if (!res.ok) {
            if (res.status === 404) {
                console.warn('No se encontraron marcas');
                return null;
            }
            throw new Error ("Error al cargar las marcas")
        }
        const data = await res.json() as Marcas;
        return data;
    } catch (error) {
        console.error('Error al obtener las marcas', error);
        throw new Error("Error al cargar las marcas");
    }
}

export async function fetchSub(marca: number): Promise<Subcategorias | null> {
    try {
        const res = await fetch(`${GET_MARK}/${marca}/subcategorias?limit=10&page=1`);
        if (!res.ok) {
            if (res.status === 404) {
                console.warn('No se encontraron subcategorias');
                return null;
            }
            throw new Error("Error al obtener las subcategorias");
        }
        const data = await res.json() as Subcategorias;
        return data;
    } catch (error) {
        console.error('Error al obtener las subcategorias', error);
        throw new Error("Error al cargar las marcas");
    }
}
