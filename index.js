const gremlin = require('gremlin');
const __ = gremlin.process.statics;
const P = gremlin.process.P;

const DriverRemoteConnection = gremlin.driver.DriverRemoteConnection;
const Graph = gremlin.structure.Graph;

const dc = new DriverRemoteConnection('ws://localhost:8182/gremlin');

const graph = new Graph();
const g = graph.traversal().withRemote(dc);

const clear = async () => {
	await g.E().drop().iterate();
	await g.V().drop().iterate();
}

const create = async () => {
	const { value: book } = await g.addV('content').property('name', 'book').next();
	const { value: card } = await g.addV('content').property('name', 'card').next();
	const { value: trolley1 } = await g.addV('location').property('name', 'trolley1').next();
	const { value: trolley2 } = await g.addV('location').property('name', 'trolley2').next();
	const { value: area } = await g.addV('location').property('name', 'area').next();
	const { value: warehouse } = await g.addV('location').property('name', 'warehouse').next();
	
	await g.addE('inside').from_(book).to(trolley1).iterate();
	await g.addE('inside').from_(card).to(trolley2).iterate();
	await g.addE('inside').from_(trolley1).to(area).iterate();
	await g.addE('inside').from_(trolley2).to(area).iterate();
	await g.addE('inside').from_(area).to(warehouse).iterate();
}

const whereIsTheBook = async () => {

	const parents = await g.V().hasLabel('content') // find all content
		.out('inside').path().by('name').toList();  // traverse their "inside" edges
													// parents: [
														// ['book', 'trolley1'],
														// ['card', 'trolley2']
													// ]

	const { value: recursivePath } = await g.V().has('name', 'book') // find vertice with name book, then
		.until(__.out('inside').count().is(P.lt(1))) 				 // until we have no more out-going edges labelled "inside"
		.repeat(__.out('inside')) 									 // traverse the "inside" edges
		.path().by('name').next(); 									 // and give us the path travelled by name

																	 // recursive path: ["book", "trolley1", "area", "warehouse"]
}

const treeView = async () => {
	const tree = await g.V().has('name', 'warehouse') // find the vertice with name warehouse, then
		.until(__.in_('inside').count().is(P.lt(1)))  // until we have no more incoming "inside" edges
		.repeat(__.in_('inside'))					  // traverse the "inside edges"
		.tree()
		.by('name')
		.next();
	
		// tree: object tree, keyed by name
	
};

const run = async () => {
	await clear();
	await create();

	await whereIsTheBook();

	await treeView();

	return process.exit();
}

run();

// TODO: profiling, tree step

