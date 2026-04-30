import type {
	IDataObject,
	IExecuteFunctions,
	INodeExecutionData,
	INodeType,
	INodeTypeDescription,
} from 'n8n-workflow';
import { NodeConnectionTypes, NodeOperationError } from 'n8n-workflow';

import {
	isPokemonListResponse,
	pokemonApiRequest,
	pokemonApiRequestAllItems,
} from './GenericFunctions';

function isDataObject(value: unknown): value is IDataObject {
	return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export class Pokemon implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'Pokemon',
		name: 'pokemon',
		icon: 'file:pokemon.svg',
		group: ['transform'],
		version: 1,
		subtitle: '={{ $parameter["operation"] + ": " + $parameter["resource"] }}',
		description: 'Consume the PokeAPI',
		defaults: {
			name: 'Pokemon',
		},
		usableAsTool: true,
		inputs: [NodeConnectionTypes.Main],
		outputs: [NodeConnectionTypes.Main],
		properties: [
			{
				displayName: 'Resource',
				name: 'resource',
				type: 'options',
				noDataExpression: true,
				options: [
					{
						name: 'Pokemon',
						value: 'pokemon',
					},
				],
				default: 'pokemon',
			},
			{
				displayName: 'Operation',
				name: 'operation',
				type: 'options',
				noDataExpression: true,
				displayOptions: {
					show: {
						resource: ['pokemon'],
					},
				},
				options: [
					{
						name: 'Get',
						value: 'get',
						description: 'Get one Pokemon by name or ID',
						action: 'Get a Pokemon',
					},
					{
						name: 'Get Many',
						value: 'getAll',
						description: 'List Pokemon',
						action: 'List Pokemon',
					},
				],
				default: 'getAll',
			},
			{
				displayName: 'Pokemon Name or ID',
				name: 'pokemonNameOrId',
				type: 'string',
				required: true,
				default: '',
				placeholder: 'pikachu or 25',
				description: 'The Pokemon name or numeric ID to retrieve',
				displayOptions: {
					show: {
						resource: ['pokemon'],
						operation: ['get'],
					},
				},
			},
			{
				displayName: 'Return All',
				name: 'returnAll',
				type: 'boolean',
				default: false,
				description: 'Whether to return all results or only up to a given limit',
				displayOptions: {
					show: {
						resource: ['pokemon'],
						operation: ['getAll'],
					},
				},
			},
			{
				displayName: 'Limit',
				name: 'limit',
				type: 'number',
				typeOptions: {
					minValue: 1,
				},
				default: 20,
				description: 'Max number of results to return',
				displayOptions: {
					show: {
						resource: ['pokemon'],
						operation: ['getAll'],
						returnAll: [false],
					},
				},
			},
			{
				displayName: 'Offset',
				name: 'offset',
				type: 'number',
				typeOptions: {
					minValue: 0,
				},
				default: 0,
				description: 'Number of Pokemon to skip before returning results',
				displayOptions: {
					show: {
						resource: ['pokemon'],
						operation: ['getAll'],
					},
				},
			},
		],
	};

	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		const items = this.getInputData();
		const returnData: INodeExecutionData[] = [];

		const getStringNodeParameter = (name: string, itemIndex: number): string => {
			const value = this.getNodeParameter(name, itemIndex);

			if (typeof value !== 'string') {
				throw new NodeOperationError(this.getNode(), `Expected "${name}" to be a string`, {
					itemIndex,
				});
			}

			return value;
		};

		const getNumberNodeParameter = (name: string, itemIndex: number): number => {
			const value = this.getNodeParameter(name, itemIndex);

			if (typeof value !== 'number') {
				throw new NodeOperationError(this.getNode(), `Expected "${name}" to be a number`, {
					itemIndex,
				});
			}

			return value;
		};

		const getBooleanNodeParameter = (name: string, itemIndex: number): boolean => {
			const value = this.getNodeParameter(name, itemIndex);

			if (typeof value !== 'boolean') {
				throw new NodeOperationError(this.getNode(), `Expected "${name}" to be a boolean`, {
					itemIndex,
				});
			}

			return value;
		};

		for (let i = 0; i < items.length; i++) {
			try {
				const resource = getStringNodeParameter('resource', i);
				const operation = getStringNodeParameter('operation', i);

				if (resource !== 'pokemon') {
					throw new NodeOperationError(this.getNode(), `The resource "${resource}" is unknown`, {
						itemIndex: i,
					});
				}

				let responseItems: IDataObject[];

				if (operation === 'get') {
					const pokemonNameOrId = getStringNodeParameter('pokemonNameOrId', i).trim();
					const responseData = await pokemonApiRequest.call(
						this,
						'GET',
						`/pokemon/${encodeURIComponent(pokemonNameOrId)}`,
					);

					if (!isDataObject(responseData)) {
						throw new NodeOperationError(
							this.getNode(),
							'Unexpected response format returned by PokeAPI when fetching a Pokemon',
							{ itemIndex: i },
						);
					}

					responseItems = [responseData];
				} else if (operation === 'getAll') {
					const offset = getNumberNodeParameter('offset', i);
					const returnAll = getBooleanNodeParameter('returnAll', i);

					if (returnAll) {
						const allPokemon = await pokemonApiRequestAllItems.call(this, offset);
						responseItems = allPokemon.map((pokemon) => ({
							name: pokemon.name,
							url: pokemon.url,
						}));
					} else {
						const limit = getNumberNodeParameter('limit', i);
						const responseData = await pokemonApiRequest.call(this, 'GET', '/pokemon', {
							limit,
							offset,
						});

						if (!isPokemonListResponse(responseData)) {
							throw new NodeOperationError(
								this.getNode(),
								'Unexpected response format returned by PokeAPI when listing Pokemon',
								{ itemIndex: i },
							);
						}

						responseItems = responseData.results.map((pokemon) => ({
							name: pokemon.name,
							url: pokemon.url,
						}));
					}
				} else {
					throw new NodeOperationError(this.getNode(), `The operation "${operation}" is unknown`, {
						itemIndex: i,
					});
				}

				const executionData = this.helpers.constructExecutionMetaData(
					this.helpers.returnJsonArray(responseItems),
					{ itemData: { item: i } },
				);

				returnData.push(...executionData);
			} catch (error) {
				if (this.continueOnFail()) {
					const message = error instanceof Error ? error.message : 'Unknown error';
					const executionErrorData = this.helpers.constructExecutionMetaData(
						this.helpers.returnJsonArray({ error: message }),
						{ itemData: { item: i } },
					);
					returnData.push(...executionErrorData);
					continue;
				}

				throw error;
			}
		}

		return [returnData];
	}
}
