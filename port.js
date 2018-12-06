const { MongoClient, ObjectId } = require('mongodb');
const bluebird = require('bluebird');

const accountId = ObjectId('SET');

const gremlin = require('gremlin');
const __ = gremlin.process.statics;
const { P, t } = gremlin.process;

const DriverRemoteConnection = gremlin.driver.DriverRemoteConnection;
const Graph = gremlin.structure.Graph;

const dc = new DriverRemoteConnection('ws://localhost:8182/gremlin');

const graph = new Graph();
const g = graph.traversal().withRemote(dc);

let locationModel;

const connect = async () => {
	try {
		// connect to mongo
		const client = await MongoClient.connect(process.env.MONGO_URL);
		const locationConnection = client.db('location-live');
		locationModel = await locationConnection.collection('location');
		contentModel = await locationConnection.collection('content');
	} catch ({ message }) {
		throw new Error(message);
	}
}

const clear = async () => {
	await g.E().drop().iterate();
	await g.V().drop().iterate();
}

const buildLocations = async () => {
	const allLocations = await locationModel.find({ accountId }).toArray();
	await bluebird.each(
		allLocations,
		async location => {
			try {
				await g.addV('location').property('_id', location._id.toString()).property('name', location.name).next()
			} catch ({ message }) {
				console.log(message);
			}
		},
	);

	await bluebird.each(
		allLocations,
		async location => {
			if(location.parentLocationId) {
				try {
					const { value: child } = await g.V().has('_id', location._id.toString()).next();
					const { value: parent } = await g.V().has('_id', location.parentLocationId.toString()).next();
					await g.addE('inside').from_(child).to(parent).iterate();
				} catch ({ message }) {
					throw new Error(message);
				}
			}
		}
	)

}

const buildContent = async () => {
	const recentContent = await contentModel.find({ parentLocationId: { $ne: null }, accountId, archivedAt: null }).limit(100).sort({ _id: -1 }).toArray();

	await bluebird.each(
		recentContent,
		async content => {
			let child;
			try {
				const { value } = await g.addV('content').property('_id', content._id.toString()).property('name', content.name).next();
				child = value;
			} catch ({ message }) {
				const { value } = await g.V().has('_id', content._id.toString()).next();
				child = value;
			}
			if(content.parentLocationId) {
				try {
					const { value: parent } = await g.V().has('_id', content.parentLocationId.toString()).next();
					await g.addE('inside').from_(child).to(parent).iterate();
				} catch ({ message }) {
					console.log(message);
				}
			}
		}
	)
}

const formatTree = (arr) => {
	const obj = {};
	arr.forEach(({ key, value }) => {
		obj[key] = formatTree(value['@value'])
	});
	return obj;
}

const writeToFile = async () => {
	// do tree lookup
	const { value: tree } = 
		await g.V().hasLabel('location').where(__.outE('inside').count().is(P.lt(1))) // get locations w/o parents
			.until(__.in_('inside').count().is(P.lt(1)))
			.repeat(__.in_('inside')).tree().by('name')
			.next();

	console.log('tree: ', tree);

	// const formatted = formatTree(tree);
	// console.log('formatted: ', formatted);

	const edges = await g.E().toList();
	const vertices = await g.V().valueMap(true).toList();
	const nodes = vertices.map(v => {
		const entries = v.entries();
		const id = entries.next().value[1];
		const name = entries.next().value;
		return { id: id, label: name[1][0] };
	});
	console.log('nodes: ', JSON.stringify(nodes));
	console.log('\n\n\n\n\n');
	const lines = edges.map(e => ({ from: e.outV, to: e.inV }));
	console.log('lines: ', JSON.stringify(lines));

	// map into correct structure
	// http://visjs.org/docs/network/

	// write to file

}

const run = async () => {
	await connect();
	await clear();
	await buildLocations();
	await buildContent();
	await writeToFile();

	process.exit();
}

run();
