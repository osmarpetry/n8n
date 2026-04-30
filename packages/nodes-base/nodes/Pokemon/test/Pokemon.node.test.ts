import { NodeTestHarness } from '@nodes-testing/node-test-harness';
import nock from 'nock';

describe('Test Pokemon Node', () => {
	const pokemonNock = nock('https://pokeapi.co');

	beforeAll(() => {
		pokemonNock
			.get('/api/v2/pokemon')
			.query({
				limit: 2,
				offset: 1,
			})
			.reply(200, {
				count: 1350,
				next: 'https://pokeapi.co/api/v2/pokemon?offset=3&limit=2',
				previous: 'https://pokeapi.co/api/v2/pokemon?offset=0&limit=1',
				results: [
					{
						name: 'ivysaur',
						url: 'https://pokeapi.co/api/v2/pokemon/2/',
					},
					{
						name: 'venusaur',
						url: 'https://pokeapi.co/api/v2/pokemon/3/',
					},
				],
			});

		pokemonNock.get('/api/v2/pokemon/pikachu').reply(200, {
			id: 25,
			name: 'pikachu',
			height: 4,
			weight: 60,
			species: {
				name: 'pikachu',
			},
		});

		pokemonNock.get('/api/v2/pokemon/25').reply(200, {
			id: 25,
			name: 'pikachu',
			height: 4,
			weight: 60,
			species: {
				name: 'pikachu',
			},
		});
	});

	afterAll(() => pokemonNock.done());

	new NodeTestHarness().setupTests({
		workflowFiles: ['Pokemon.workflow.test.json'],
	});
});
