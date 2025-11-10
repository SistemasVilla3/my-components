import type { ApiResponse, Articulo } from './types';

const API_ART_SKU = '/api/articulos';

export type ArticuloResponse = ApiResponse<Articulo | null>;

export async function fetchItem(sku: string): Promise<ArticuloResponse | null> {
    try {
        const res = await fetch(`${API_ART_SKU}/${encodeURIComponent(String(sku))}`);
        if (!res.ok) {
            if (res.status === 404) {
                console.warn('No se encontraron articulos para el sku', sku);
                return null;
            }
            throw new Error("Error al cargar los conteos finalizados");
        }
        const data = await res.json() as ArticuloResponse;
        return data;
    } catch (e){
        console.error('Error al obtener el articulo', e);
        throw new Error("Error al cargar el articulo");
    }
}
