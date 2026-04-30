import type {
	IDataObject,
	IExecuteFunctions,
	IHookFunctions,
	IHttpRequestMethods,
	ILoadOptionsFunctions,
	IRequestOptions,
	JsonObject,
} from 'n8n-workflow';
import { NodeApiError } from 'n8n-workflow';

interface PokemonListResult {
	name: string;
	url: string;
}

interface PokemonListResponse {
	count: number;
	next: string | null;
	previous: string | null;
	results: PokemonListResult[];
}

function isObjectLiteral(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isPokemonListResult(value: unknown): value is PokemonListResult {
	if (!isObjectLiteral(value)) {
		return false;
	}

	return typeof value.name === 'string' && typeof value.url === 'string';
}

export function isPokemonListResponse(value: unknown): value is PokemonListResponse {
	if (!isObjectLiteral(value)) {
		return false;
	}

	return (
		typeof value.count === 'number' &&
		(value.next === null || typeof value.next === 'string') &&
		(value.previous === null || typeof value.previous === 'string') &&
		Array.isArray(value.results) &&
		value.results.every(isPokemonListResult)
	);
}

export async function pokemonApiRequest(
	this: IHookFunctions | IExecuteFunctions | ILoadOptionsFunctions,
	method: IHttpRequestMethods,
	endpoint: string,
	qs: IDataObject = {},
): Promise<unknown> {
	const options: IRequestOptions = {
		method,
		qs,
		uri: `https://pokeapi.co/api/v2${endpoint}`,
		json: true,
	};

	try {
		return await this.helpers.request(options);
	} catch (error) {
		const errorData: JsonObject =
			error instanceof Error ? { message: error.message } : { message: 'Unknown PokeAPI error' };
		throw new NodeApiError(this.getNode(), errorData);
	}
}

export async function pokemonApiRequestAllItems(
	this: IHookFunctions | IExecuteFunctions | ILoadOptionsFunctions,
	startOffset: number,
): Promise<PokemonListResult[]> {
	const returnData: PokemonListResult[] = [];
	let offset = startOffset;
	let responseData: unknown;

	do {
		responseData = await pokemonApiRequest.call(this, 'GET', '/pokemon', {
			limit: 100,
			offset,
		});

		if (!isPokemonListResponse(responseData)) {
			const errorData: JsonObject = {
				message: 'Unexpected response format returned by PokeAPI when listing Pokemon',
			};
			throw new NodeApiError(this.getNode(), errorData);
		}

		returnData.push(...responseData.results);
		offset += responseData.results.length;
	} while (isPokemonListResponse(responseData) && responseData.next !== null);

	return returnData;
}
