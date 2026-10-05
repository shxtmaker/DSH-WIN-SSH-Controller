/** Enumerate selectable Host aliases from the user config and its Include files.
 * @param home - user home containing .ssh/config.
 * @returns unique literal aliases; patterns and negated hosts are omitted.
 */
export declare function listSshAliases(home?: string): Promise<string[]>;
//# sourceMappingURL=aliases.d.ts.map