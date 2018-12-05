const { MongoClient, ObjectId } = require('mongodb');
const bluebird = require('bluebird');

const accountId = ObjectId('524ac7b6019a607957000033');
const graphName = 'prime-test1';

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
				await g.addV('location').property(t.id, parseInt(location._id.toString(), 16) / 10000000000000).property('name', location.name).next()
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
					const { value: child } = await g.V(parseInt(location._id.toString(), 16) / 10000000000000).next();
					const { value: parent } = await g.V(parseInt(location.parentLocationId.toString(), 16) / 10000000000000).next();
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
				const { value } = await g.addV('content').property(t.id, parseInt(content._id.toString(), 16) / 10000000000000).property('name', content.name).next();
				child = value;
			} catch ({ message }) {
				const { value } = await g.V(parseInt(content._id.toString(), 16) / 10000000000000).next();
				child = value;
			}
			if(content.parentLocationId) {
				try {
					const { value: parent } = await g.V(parseInt(content.parentLocationId.toString(), 16) / 10000000000000).next();
					await g.addE('inside').from_(child).to(parent).iterate();
				} catch ({ message }) {
					console.log(message);
				}
			}
		}
	)
}

const writeToFile = async () => {
	// do tree lookup

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
