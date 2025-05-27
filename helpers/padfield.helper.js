exports.padField = function (value, length, alignment = 'left', padChar = ' ') {
    value = value?.toString() ?? '';
    if (value.length > length) {
        return value.substring(0, length);
    }
    return alignment === 'right'
        ? value.padStart(length, padChar)
        : value.padEnd(length, padChar);
}