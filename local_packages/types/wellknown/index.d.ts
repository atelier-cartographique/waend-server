// Type definitions for wellknown 0.5
// Project: https://github.com/mapbox/wellknown#readme
// Definitions by: My Self <https://github.com/me>
// Definitions: https://github.com/DefinitelyTyped/DefinitelyTyped



/// <reference types="geojson" />
export function parse(a: string): GeoJSON.GeoJsonObject;
export function stringify(a: GeoJSON.GeoJsonObject): string;

