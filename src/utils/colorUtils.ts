import { colord, extend } from "colord";
import namesPlugin from "colord/plugins/names";
import a11yPlugin from "colord/plugins/a11y";

extend([namesPlugin, a11yPlugin]);

/**
 * Calculates a darker shade of the given color to use as a border/shadow color.
 * This creates the 3D effect for the button.
 * @param colorStr - The hex color string or CSS color name
 * @param amount - How much to darken (0-1), default roughly matches the preset styles
 */
export const getDarkerColor = (colorStr: string, amount: number = 0.15): string => {
    return colord(colorStr).darken(amount).toHex();
};

/**
 * Determines the best text color (black or white) for a given background color
 * to ensure accessible contrast.
 * @param backgroundColor - The background color of the button
 */
export const getContrastingTextColor = (backgroundColor: string): string => {
    return colord(backgroundColor).isLight() ? "black" : "white";
};

/**
 * Validates if the string is a valid CSS color
 */
export const isValidColor = (color: string): boolean => {
    return colord(color).isValid();
}
