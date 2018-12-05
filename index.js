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
	try {
		const { value: book } = await g.addV('content').property('name', 'book').next();
		const { value: card } = await g.addV('content').property('name', 'card').next();
		const { value: trolley1 } = await g.addV('location').property('name', 'trolley1').next();
		const { value: area } = await g.addV('location').property('name', 'area').next();
		const { value: warehouse } = await g.addV('location').property('name', 'warehouse').next();
		
		await g.addE('inside').from_(book).to(trolley1).iterate();
		await g.addE('inside').from_(card).to(trolley1).iterate();
		await g.addE('inside').from_(trolley1).to(area).iterate();
		await g.addE('inside').from_(area).to(warehouse).iterate();

	} catch (error) {
		console.log('error: ', error);
	}
}

const whereIsTheBook = async () => {

	try {
		// here's a book
		const { value: book } = await g.V().has('name', 'book').next();
		const bookPath = await g.V(book.id)
			.out('inside')
			.out('inside')
			.out('inside')
			.path().by('name').next();

		// query by id -- but could chain ^^
		const { value: recursivePath } = await g.V(book.id)
			// .until(__.has('name', 'warehouse'))
			.until(__.out('inside').count().is(P.lt(1)))
			.repeat(__.out('inside'))
			.path().by('name').next();

		console.log('recursivePath: ', recursivePath);
	} catch (error) {
		console.log('error: ', error);
	}
}

const treeView = async () => {
	const tree = await g.V().has('name', 'warehouse')
		// .in_('inside').in_('inside').in_('inside').values('name')
		.until(__.in_('inside').count().is(P.lt(1)))
		.repeat(__.in_('inside'))
		.tree()
		// .by('name')
		.next();

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

