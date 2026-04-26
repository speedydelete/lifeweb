
import {Pattern} from './pattern.js';


export type Rotation = 'F' | 'Fx' | 'L' | 'Lx' | 'B' | 'Bx' | 'R' | 'Rx';

export interface RPF<T extends Pattern> {
    key: string;
    name?: string;
    data: (T | {
        value: RPF<T>;
        x: number;
        y: number;
        rotation: Rotation;
    })[];
}
