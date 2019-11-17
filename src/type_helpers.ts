/* Web Lic - Copyright (C) 2019 Remi Gagne */

export function hasProperty<T extends Item>(item: Item | null, prop: string): item is T {
	return (item != null) && item.hasOwnProperty(prop);
}

export function hasListProperty(item: Item | null, prop: ItemTypes): item is ItemWithChildList {
	return (item != null) && item.hasOwnProperty(prop + 's');
}

export function isItemSpecificType<T extends Item>(item: Item | null, itemType: string): item is T {
	return (item != null) && item.type === itemType;
}

export function isPLIItem(item: Item | null): item is PLIItem {
	return (item != null) && item.type === 'pliItem';
}
