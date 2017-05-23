/// <reference types="node" />

export declare class BloomFilter {

    public static deserialize(buf: Buffer): BloomFilter;

    /**
     * Initializes a new filter.
     */
    constructor (bits: number, hashFuncs: number);
    /**
     * Initializes a new filter from an array.
     */
    constructor (data: ArrayLike<number>);

    /**
     * Adds an item to the filter
     */
    public add (str: string): void;

    /**
     * Returns true if the item may be in the set and false if it's not.
     */
    public test (str: string): boolean;

    public locations (num: number): number[];

    /**
     * Gets the estimated size.
     */
    public size(): number;

    public serialize (): Buffer;
}

/**
 * Fowler/Noll/Vo hashing.
 */
export declare function fnv_1a(num: number): number;

/**
 * One additional iteration of FNV, given a hash.
 */
export declare function fnv_1a_b(num: number): number;
