
import {c, ChannelInfo, RecipeData, Elbow, ChannelRecipe} from './base.js';


/** Merges multiple restricted-channel recipes. */
export function mergeRecipes(info: c.ChannelInfo, ...recipes: [number, number, number][][]): [number, number, number][] {
    let recipe = recipes.flat();
    let out: [number, number, number][] = [];
    for (let i = 0; i < recipe.length; i++) {
        let [spacing, channel, slow] = recipe[i];
        if (channel === -1) {
            if (i !== recipe.length - 1) {
                if (recipe[i + 1][0] === -1) {
                    i++;
                    channel = recipe[i][1];
                } else {
                    channel = 0;
                }
            }
        } else if (channel === -2) {
            if (out.length === 0) {
                out.push([spacing, channel, slow]);
            } else {
                out[out.length - 1][0] += spacing;
            }
            continue;
        }
        out.push([spacing, channel, slow]);
    }
    return out;
}


export interface CompilerRecipes {
    move: {[key: string]: (ChannelRecipe & {end: {}, emit: undefined, create: undefined})[]};
    emit: {[key: string]: (ChannelRecipe & {end: {}, emit: {}, create: undefined})[]};
    create: {[key: string]: (ChannelRecipe & {end: {}, emit: undefined, create: {}})[]};
    destroy: {[key: string]: (ChannelRecipe & {end: undefined, emit: undefined, create: undefined})[]};
    emitDestroy: {[key: string]: (ChannelRecipe & {end: undefined, emit: {}, create: undefined})[]};
    createDestroy: {[key: string]: (ChannelRecipe & {end: undefined, emit: undefined, create: {}})[]};
}

export function sortRecipes(recipes: RecipeData['channels'][string]): CompilerRecipes {
    let out: CompilerRecipes = {move: {}, emit: {}, create: {}, destroy: {}, emitDestroy: {}, createDestroy: {}};
    for (let recipe of Object.values(recipes.recipes)) {
        if (recipe.end) {
            if (recipe.emit) {
                if (recipe.create) {
                    continue;
                }
                // @ts-ignore
                out.emit[recipe.end.elbow].push(recipe);
            } else if (recipe.create) {
                // @ts-ignore
                out.create[recipe.end.elbow].push(recipe);
            } else {
                // @ts-ignore
                out.move[recipe.end.elbow].push(recipe);
            }
        } else {
            if (recipe.emit) {
                if (recipe.create) {
                    continue;
                }
                // @ts-ignore
                out.emitDestroy[recipe.end.elbow].push(recipe);
            } else if (recipe.create) {
                // @ts-ignore
                out.createDestroy[recipe.end.elbow].push(recipe);
            } else {
                // @ts-ignore
                out.destroy[recipe.end.elbow].push(recipe);
            }
        }
    }
    return out;
}


interface RecipeProgress {
    data: [number, number, number][][];
    time: number;
    index: number;
    elbow: Elbow;
    elbowPos: number;
}


/** Converts a slow salvo to a restricted-channel recipe. */
export function salvoToChannel(info: ChannelInfo, recipes: CompilerRecipes, start: Elbow, salvo: [number, number][], dir: c.ShipDirection, depth?: number, beam?: number, forceEndElbow?: false | string, minElbow?: number, maxElbow?: number): {recipe: [number, number, number][], time: number, elbow: false | [Elbow, number]} {
    let prevLayer: RecipeProgress[] = [{data: [], time: 0, index: 0, elbow: start, elbowPos: 0}];
    depth ??= salvo.length;
    let out: {data: [number, number, number][][], time: number, elbow: false | [Elbow, number]}[] = [];
    for (let i = 0; i < depth; i++) {
        let nextLayer: RecipeProgress[] = [];
        for (let {data, time, index, elbow, elbowPos} of prevLayer) {
            if (index < salvo.length) {
                for (let recipe of recipes.emit[elbow.str]) {
                    if (recipe.emit[0].lane + start.lane - elbow.lane === salvo[index][0] && recipe.emit[0].timing === salvo[index][1]) {
                        let data2 = data.slice();
                        data2.push(recipe.recipe);
                        let newElbowPos = elbowPos + recipe.end.move;
                        if ((minElbow !== undefined && newElbowPos < minElbow) || (maxElbow !== undefined && newElbowPos > maxElbow)) {
                            continue;
                        }
                        if (index + 1 === salvo.length && (typeof forceEndElbow !== 'number' || forceEndElbow === newElbowPos)) {
                            out.push({
                                data: data2,
                                time: time + recipe.time,
                                elbow: [recipe.end, newElbowPos],
                            })
                        } else {
                            nextLayer.push({
                                data: data2,
                                time: time + recipe.time,
                                index: index + 1,
                                elbow: recipe.end,
                                elbowPos: newElbowPos,
                            })
                        }
                    }
                }
            }
            for (let recipe of recipes.move[elbow.str]) {
                let data2 = data.slice();
                data2.push(recipe.recipe);
                let newElbowPos = elbowPos + recipe.end.move;
                if ((minElbow !== undefined && newElbowPos < minElbow) || (maxElbow !== undefined && newElbowPos > maxElbow)) {
                    continue;
                }
                if (index === salvo.length && (typeof forceEndElbow !== 'number' || forceEndElbow === newElbowPos)) {
                    out.push({
                        data: data2,
                        time: time + recipe.time,
                        elbow: [recipe.end, newElbowPos],
                    })
                } else {
                    let data2 = data.slice();
                    data2.push(recipe.recipe);
                    nextLayer.push({
                        data: data2,
                        time: time + recipe.time,
                        index,
                        elbow: recipe.end,
                        elbowPos: newElbowPos,
                    })
                }
            }
            if (index === salvo.length - 1 && forceEndElbow === false) {
                for (let recipe of recipes.emitDestroy[elbow.str]) {
                    if (recipe.emit[0].lane + start.lane - elbow.lane === salvo[index][0] && recipe.emit[0].timing === salvo[index][1]) {
                        let data2 = data.slice();
                        data2.push(recipe.recipe);
                        out.push({
                            data: data2,
                            time: time + recipe.time,
                            elbow: false,
                        });
                    }
                }
            }
            if (index === salvo.length && forceEndElbow === false) {
                for (let recipe of recipes.destroy[elbow.str]) {
                    let data2 = data.slice();
                    data2.push(recipe.recipe);
                    out.push({
                        data: data2,
                        time: time + recipe.time,
                        elbow: false,
                    });
                }
            }
        }
        if (beam !== undefined) {
            nextLayer = nextLayer.sort((x, y) => {
                if (x.index < y.index) {
                    return 1;
                } else if (x.index > y.index) {
                    return -1;
                } else {
                    if (x.time < y.time) {
                        return -1;
                    } else if (x.time > y.time) {
                        return 1;
                    } else {
                        return 0;
                    }
                }
            });
            nextLayer = nextLayer.slice(0, beam);
        }
        if (nextLayer.length === 0) {
            throw new Error(`Cannot find recipe at depth ${i}!`);
        }
        prevLayer = nextLayer;
    }
    if (out.length === 0) {
        throw new Error('No recipes found!');
    }
    let best = out[0];
    for (let recipe of out.slice(1)) {
        if (recipe.time < best.time) {
            best = recipe;
        }
    }
    let recipe = mergeRecipes(info, ...best.data);
    let time = 0;
    for (let [spacing] of recipe) {
        time += spacing;
    }
    return {
        recipe,
        time,
        elbow: best.elbow,
    };
}
