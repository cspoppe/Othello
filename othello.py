# class OthelloDb:

#     def __init__(self):
#         self.games = {}

#     def add_game(self, room, playerWhite, sid):
#         game = OthelloGame(room, playerWhite, sid)
#         self.games[room] = game

#     def add_playerBlack(self, room, playerBlack, sid):
#         game = self.games[room]
#         game.add_playerBlack(playerBlack, sid)

#     def get_game(self, room):
#         pass

#     def does_game_exist(self, room):
#         if room in self.games:
#             return True
#         return False

#     def is_room_full(self, room):
#         game = self.games[room]
#         return game.roomFull

class Othello:

    def __init__(self):
        self.games = {}

    def add_game(self, room, playerWhite, sid):
        self.games[room] = {
            'white': {'name': playerWhite, 'sid': sid},
            'black': None,
            'roomFull': False,
            'rematch': {'white': None, 'black': None}
        }

    # def __init__(self, room, playerWhite, sid):
    #     self.room = room
    #     self.playerWhite = {'name': playerWhite, 'sid': sid}
    #     self.playerBlack = None
    #     self.roomFull = False
    #     self.rematch = {'white': None, 'black': None}

    def add_playerBlack(self, room, playerBlack, sid):
        game = self.games[room]
        game['black'] = {'name': playerBlack, 'sid': sid}
        game['roomFull'] = True

    def get_player(self, room, color):
        game = self.games[room]
        return game[color]['name']

    def get_opp_rematch(self, room, player):
        game = self.games[room]
        if (player == 'white'):
            return game['rematch']['black']
        else:
            return game['rematch']['white']

    def get_sid(self, room, player):
        game = self.games[room]
        if (player == 'white'):
            return game['white']['sid']
        else:
            return game['black']['sid']

    def get_opp_sid(self, room, player):
        game = self.games[room]
        if (player == 'black'):
            return game['white']['sid']
        else:
            return game['black']['sid']

    def set_rematch(self, room, player, isRematch):
        game = self.games[room]
        game['rematch'][player] = isRematch

    def reset_rematch(self, room):
        game = self.games[room]
        game['rematch'] = {'white': None, 'black': None}

    def delete_game(self, room):
        if room in self.games:
            del self.games[room]

    def does_game_exist(self, room):
        if room in self.games:
            return True
        return False

    def is_room_full(self, room):
        game = self.games[room]
        return game['roomFull']